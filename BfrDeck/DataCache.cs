using System.IO;
using System.Net.Http;
using System.Security.Cryptography;
using System.Text;

namespace BfrDeck;

/// <summary>
/// Read-through disk cache for the public bfrevive.net JSON feeds.
/// Fresh for a few hours; serves the last good copy when the site is unreachable.
/// Only hosts on the allowlist are fetched, so the page cannot turn this into an open proxy.
/// </summary>
public sealed class DataCache
{
    private static readonly HashSet<string> Allowed = new(StringComparer.OrdinalIgnoreCase)
    {
        "bfrevive.net", "www.bfrevive.net", "cdn.bfrevive.net",
    };
    private static readonly TimeSpan Ttl = TimeSpan.FromHours(3);          // the JSON feeds (pushed twice a day)
    private static readonly TimeSpan ImageTtl = TimeSpan.FromDays(14);     // CDN art never changes for a given id
    private const long MaxBytes = 300L * 1024 * 1024;                      // cache size cap; oldest files go first
    private readonly HttpClient _http = new() { Timeout = TimeSpan.FromSeconds(30) };
    private readonly string _dir;
    private readonly SemaphoreSlim _gate = new(4);
    private int _writes;

    public sealed record Entry(byte[] Bytes, string ContentType, long AgeSeconds, bool Stale);

    public DataCache()
    {
        _dir = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "BfrDeck", "cache");
        Directory.CreateDirectory(_dir);
        _http.DefaultRequestHeaders.UserAgent.ParseAdd("BfrDeck/0.1 (+companion app; read-only)");
        Task.Run(Trim);
    }

    /// <summary>Keeps the cache under MaxBytes by deleting the least recently written files. Cheap; runs at start
    /// and every 200 writes.</summary>
    public void Trim()
    {
        try
        {
            var files = new DirectoryInfo(_dir).GetFiles("*.bin").OrderBy(f => f.LastWriteTimeUtc).ToList();
            long total = files.Sum(f => f.Length);
            foreach (var f in files)
            {
                if (total <= MaxBytes) break;
                total -= f.Length;
                try { f.Delete(); File.Delete(Path.ChangeExtension(f.FullName, ".type")); } catch { }
            }
        }
        catch { }
    }

    public async Task<Entry?> GetAsync(string url, bool forceFresh = false)
    {
        if (!Uri.TryCreate(url, UriKind.Absolute, out var uri) || uri.Scheme != "https" || !Allowed.Contains(uri.Host))
            return null;
        var key = Convert.ToHexString(SHA1.HashData(Encoding.UTF8.GetBytes(url)))[..24];
        var body = Path.Combine(_dir, key + ".bin");
        var meta = Path.Combine(_dir, key + ".type");
        var exists = File.Exists(body);
        var age = exists ? DateTime.UtcNow - File.GetLastWriteTimeUtc(body) : TimeSpan.MaxValue;
        var ttl = uri.Host.StartsWith("cdn.", StringComparison.OrdinalIgnoreCase) ? ImageTtl : Ttl;
        if (exists && !forceFresh && age < ttl)
            return new Entry(await File.ReadAllBytesAsync(body), ReadType(meta), (long)age.TotalSeconds, false);

        await _gate.WaitAsync();
        try
        {
            using var res = await _http.GetAsync(uri);
            if (res.IsSuccessStatusCode)
            {
                var bytes = await res.Content.ReadAsByteArrayAsync();
                var type = res.Content.Headers.ContentType?.ToString() ?? "application/octet-stream";
                await File.WriteAllBytesAsync(body, bytes);
                await File.WriteAllTextAsync(meta, type);
                if (Interlocked.Increment(ref _writes) % 200 == 0) _ = Task.Run(Trim);
                return new Entry(bytes, type, 0, false);
            }
        }
        catch { /* fall through to the stale copy */ }
        finally { _gate.Release(); }

        if (exists) return new Entry(await File.ReadAllBytesAsync(body), ReadType(meta), (long)age.TotalSeconds, true);
        return null;
    }

    private static string ReadType(string meta)
    {
        try { return File.Exists(meta) ? File.ReadAllText(meta) : "application/json"; } catch { return "application/json"; }
    }
}
