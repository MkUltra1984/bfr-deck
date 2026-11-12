using System.Diagnostics;
using System.IO;
using System.IO.Compression;
using System.Net.Http;
using System.Reflection;
using System.Security.Cryptography;
using System.Text.Json.Nodes;

namespace BfrDeck;

// In-app update from the public releases page (github.com/MkUltra1984/bfr-deck).
//
// A release carries three files (tools\release.ps1 builds them):
//   update.json           { version, notes, host, web: { asset, sha256, size }, full: { asset, sha256, size } }
//   BfrDeck-web.zip       the wwwroot folder: where nearly every change lives (under 1 MB)
//   BfrDeck-win-x64.zip   BfrDeck.exe, the download for new users (about 60 MB)
//
// "host" is a key of the program's own source (C#, XAML, project). When it equals the key this exe was built with,
// the program itself has not changed and only the web part is fetched: it is unpacked to
// %LOCALAPPDATA%\BfrDeck\wwwroot\web-<version> and the deck reloads from there. Otherwise the full zip is fetched and
// the exe replaced: a running file cannot be overwritten, but it can be renamed, so the old one becomes
// BfrDeck.exe.old, the new one takes its place, the deck restarts, and the .old file is removed on that start.
public sealed class Updater
{
    public const string DefaultBase = "https://github.com/MkUltra1984/bfr-deck/releases/latest/download/";
    public const string ReleasePage = "https://github.com/MkUltra1984/bfr-deck/releases/latest";
    private readonly string _dataDir, _base;
    private readonly Action<string> _log;
    private readonly HttpClient _http;
    private readonly object _lock = new();
    private JsonObject? _remote;      // the last update.json
    private bool _busy;
    private object? _progress;        // { done, total } while a download runs
    private string? _error, _updated;

    public Func<string, Task>? WebReady;   // a new web part is unpacked in this folder: map it and reload the deck
    public Action? RestartReady;           // the exe is replaced: start it and close this one

    // version of the UI in use: the exe's own, or the one of a web update on top of it
    public string Current { get; private set; }

    public Updater(string dataDir, string? webVersion, Action<string> log)
    {
        _dataDir = dataDir; _log = log; Current = webVersion ?? AppVersion;
        // test hook: another address for the update files (a local folder served over http)
        var o = Environment.GetEnvironmentVariable("BFRDECK_UPDATE_URL");
        _base = !string.IsNullOrWhiteSpace(o) && Uri.TryCreate(o, UriKind.Absolute, out _) ? (o.EndsWith('/') ? o : o + "/") : DefaultBase;
        _http = new HttpClient { Timeout = TimeSpan.FromMinutes(15) };
        _http.DefaultRequestHeaders.UserAgent.ParseAdd("BfrDeck/" + AppVersion);
        if (Environment.GetCommandLineArgs().Contains("--updated")) _updated = Current;
        _ = Task.Run(RemoveOldExe);
    }

    public static string AppVersion => typeof(Updater).Assembly.GetName().Version?.ToString(3) ?? "0";
    // set by tools\publish.ps1; a development build has none and is never updated
    public static string HostKey => typeof(Updater).Assembly.GetCustomAttributes<AssemblyMetadataAttribute>().FirstOrDefault(a => a.Key == "HostKey")?.Value ?? "";
    private static string ExePath => Environment.ProcessPath ?? "";
    public bool Supported => HostKey.Length > 0 && ExePath.EndsWith(".exe", StringComparison.OrdinalIgnoreCase) && !Directory.Exists(Path.Combine(AppContext.BaseDirectory, "wwwroot"));

    private static bool Newer(string a, string b) => Version.TryParse(a, out var x) && Version.TryParse(b, out var y) && x > y;

    // The newest unpacked web update that belongs to this exe and is newer than the UI inside it, or null.
    public static (string Dir, string Version)? InstalledWeb(string dataDir)
    {
        (string Dir, string Version)? best = null;
        try
        {
            var www = Path.Combine(dataDir, "wwwroot");
            if (HostKey.Length == 0 || !Directory.Exists(www)) return null;
            foreach (var d in Directory.EnumerateDirectories(www, "web-*"))
            {
                var ver = Path.GetFileName(d).Substring(4);
                if (!File.Exists(Path.Combine(d, ".complete")) || !File.Exists(Path.Combine(d, "index.html"))) continue;
                if (File.ReadAllText(Path.Combine(d, ".host")).Trim() != HostKey) continue;
                if (Newer(ver, best?.Version ?? AppVersion)) best = (d, ver);
            }
        }
        catch { }
        return best;
    }

    // { supported, current, available, version, notes, kind, size, busy, progress, error, updated, page }
    public object Status()
    {
        lock (_lock)
        {
            string remote = (string?)_remote?["version"] ?? "";
            bool available = Supported && remote.Length > 0 && Newer(remote, Current);
            bool web = available && WebOnly();
            return new
            {
                supported = Supported, current = Current, available, version = remote, notes = (string?)_remote?["notes"] ?? "",
                kind = !available ? "" : web ? "web" : "full", size = available ? (long?)_remote?[web ? "web" : "full"]?["size"] ?? 0 : 0,
                busy = _busy, progress = _progress, error = _error, updated = _updated, page = ReleasePage,
            };
        }
    }
    private bool WebOnly() => (string?)_remote?["host"] == HostKey && _remote?["web"] is JsonObject;

    public async Task<object> Check()
    {
        if (!Supported) return Status();
        try
        {
            // the query string changes every time: right after a release the "latest" address can still hand out the previous file
            var text = await _http.GetStringAsync(_base + "update.json?t=" + DateTimeOffset.UtcNow.ToUnixTimeSeconds());
            if (JsonNode.Parse(text) is JsonObject o) lock (_lock) { _remote = o; _error = null; }
        }
        catch (Exception ex) { _log("update check: " + ex.Message); }   // offline is no error worth showing
        return Status();
    }

    public async Task Apply()
    {
        lock (_lock) { if (_busy) return; _busy = true; _error = null; }
        try
        {
            if (_remote == null) await Check();
            string version = (string?)_remote?["version"] ?? "";
            if (!Supported || _remote == null || !Newer(version, Current)) return;
            bool web = WebOnly();
            var part = _remote[web ? "web" : "full"] as JsonObject ?? throw new InvalidDataException("The update description is incomplete.");
            var work = Path.Combine(_dataDir, "update"); if (Directory.Exists(work)) Directory.Delete(work, true); Directory.CreateDirectory(work);
            string asset = Path.GetFileName((string)part["asset"]!), zip = Path.Combine(work, asset);
            if (!web)
            {   // writable? (a deck under Program Files is not)
                try { var probe = Path.Combine(Path.GetDirectoryName(ExePath)!, ".bfrdeck-write-test"); File.WriteAllText(probe, ""); File.Delete(probe); }
                catch { throw new InvalidOperationException("The folder BfrDeck.exe sits in is not writable. Move it somewhere else, or download the new version by hand."); }
            }

            // 1. download and check before anything is changed
            long total = (long?)part["size"] ?? 0, done = 0;
            _progress = new { done, total };
            using (var resp = await _http.GetAsync(_base + asset, HttpCompletionOption.ResponseHeadersRead))
            {
                resp.EnsureSuccessStatusCode();
                await using var src = await resp.Content.ReadAsStreamAsync(); await using var dst = File.Create(zip);
                var buf = new byte[1 << 16]; int n;
                while ((n = await src.ReadAsync(buf)) > 0) { await dst.WriteAsync(buf.AsMemory(0, n)); done += n; _progress = new { done = Math.Min(done, Math.Max(total, done)), total = Math.Max(total, done) }; }
            }
            string hash; await using (var fs = File.OpenRead(zip)) hash = Convert.ToHexString(await SHA256.HashDataAsync(fs));
            if (!hash.Equals((string?)part["sha256"], StringComparison.OrdinalIgnoreCase)) throw new InvalidDataException("The download does not match its checksum. Please try again.");

            // 2. put it in place
            if (web)
            {
                var www = Path.Combine(_dataDir, "wwwroot"); string dir = Path.Combine(www, "web-" + version), tmp = dir + ".tmp";
                if (Directory.Exists(tmp)) Directory.Delete(tmp, true);
                Extract(zip, tmp);
                if (!File.Exists(Path.Combine(tmp, "index.html"))) throw new InvalidDataException("The update is incomplete.");
                File.WriteAllText(Path.Combine(tmp, ".host"), HostKey);
                File.WriteAllText(Path.Combine(tmp, ".complete"), DateTime.UtcNow.ToString("o"));
                if (Directory.Exists(dir)) Directory.Delete(dir, true);
                Directory.Move(tmp, dir);
                _log($"update: {Current} -> {version} (web)");
                lock (_lock) { Current = version; _updated = version; }
                try { Directory.Delete(work, true); } catch { }
                if (WebReady != null) await WebReady(dir);
            }
            else
            {
                string exe = ExePath, fresh = exe + ".new", old = exe + ".old";
                using (var z = ZipFile.OpenRead(zip))
                {
                    var entry = z.Entries.FirstOrDefault(e => e.Name.Equals("BfrDeck.exe", StringComparison.OrdinalIgnoreCase)) ?? throw new InvalidDataException("The update is incomplete.");
                    entry.ExtractToFile(fresh, true);
                }
                if (File.Exists(old)) File.Delete(old);
                File.Move(exe, old);
                try { File.Move(fresh, exe); } catch { File.Move(old, exe); throw; }
                try { File.SetAttributes(old, File.GetAttributes(old) | FileAttributes.Hidden); } catch { }
                _log($"update: {Current} -> {version} (full)");
                try { Directory.Delete(work, true); } catch { }
                RestartReady?.Invoke();
            }
        }
        catch (Exception ex) { lock (_lock) _error = ex is HttpRequestException or TaskCanceledException ? "The download failed. Check your connection and try again." : ex.Message; _log("update: " + ex); }
        finally { lock (_lock) { _busy = false; _progress = null; } }
    }

    private static void Extract(string zip, string dir)
    {
        Directory.CreateDirectory(dir);
        string root = Path.GetFullPath(dir) + Path.DirectorySeparatorChar;
        using var z = ZipFile.OpenRead(zip);
        foreach (var e in z.Entries)
        {
            if (e.FullName.EndsWith('/') || e.FullName.EndsWith('\\')) continue;
            var to = Path.GetFullPath(Path.Combine(dir, e.FullName));
            if (!to.StartsWith(root, StringComparison.OrdinalIgnoreCase)) throw new InvalidDataException("unsafe path in the update: " + e.FullName);
            Directory.CreateDirectory(Path.GetDirectoryName(to)!);
            e.ExtractToFile(to, true);
        }
    }

    // the exe a full update moved aside; the previous deck may still be closing, so try a few times
    private static async Task RemoveOldExe()
    {
        var old = ExePath + ".old";
        for (int i = 0; i < 10 && ExePath.Length > 0 && File.Exists(old); i++)
        {
            try { File.SetAttributes(old, FileAttributes.Normal); File.Delete(old); } catch { await Task.Delay(2000); }
        }
    }

    // starts the replaced exe; the caller closes this one
    public bool Restart()
    {
        try { Process.Start(new ProcessStartInfo(ExePath, "--updated") { UseShellExecute = false, WorkingDirectory = Path.GetDirectoryName(ExePath)! }); return true; }
        catch (Exception ex) { _log("restart: " + ex.Message); return false; }
    }
}
