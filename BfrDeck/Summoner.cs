using System.IO;
using System.Net;
using System.Net.Http;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;

namespace BfrDeck;

/// <summary>
/// The player's own account, read from "My Summoner" (bfrevive.net/my-summoner) with the player's own sign-in.
/// Read-only: it signs in, reads a fixed list of account parts and signs out; it never changes anything.
/// The session lives in memory. "Remember me" keeps the login in a file protected by Windows for this user only
/// (DPAPI), in the program's data folder, never in the project. Answers are kept for a minute and one request runs
/// at a time, so the service is not asked more often than its own page would.
/// EXPERIMENTAL, own account only: the service is the BFR team's; this must not ship before they agree to it.
/// </summary>
public sealed class Summoner
{
    private static readonly Uri Api = new("https://bfrevive.net/companion/api/");
    // The account parts this program may read: fixed names, and a few with a number or a theme in them
    // (one copy, one squad and its sphere plan, the team builder, one unit report). An optional query is passed on
    // when it only holds simple values (kind, friend, unit, targets).
    private static readonly System.Text.RegularExpressions.Regex PartOk = new(@"^(me|home|profile|box|squads|evolutions|challenges|history|next|progress|collection|builder|box/\d{1,12}|squads/\d{1,2}(/spheres)?|builder/[a-z0-9_]{1,40}|units/\d{1,12})(\?[a-z]{1,10}=[a-z0-9_,%]{1,220}(&[a-z]{1,10}=[a-z0-9_,%]{1,220}){0,3})?$");
    private static readonly TimeSpan Keep = TimeSpan.FromSeconds(60);

    private readonly HttpClient _http;
    private readonly string _file;
    private readonly Action<string> _log;
    private readonly Dictionary<string, (DateTime At, byte[] Body)> _cache = new();
    private readonly SemaphoreSlim _gate = new(1);

    public string? Name { get; private set; }
    public bool SignedIn => Name != null;
    public bool Saved => File.Exists(_file);

    public Summoner(string dataDir, string version, Action<string> log)
    {
        _file = Path.Combine(dataDir, "summoner.bin");
        _log = log;
        _http = new HttpClient(new HttpClientHandler { CookieContainer = new CookieContainer(), UseCookies = true }) { Timeout = TimeSpan.FromSeconds(30) };
        _http.DefaultRequestHeaders.UserAgent.ParseAdd($"BfrDeck/{version} (+companion app; read-only; the player's own account)");
        _http.DefaultRequestHeaders.Accept.ParseAdd("application/json");
    }

    public object State() => new { signedIn = SignedIn, name = Name, saved = Saved };

    /// <summary>Signs in. Returns the HTTP status and a sentence to show when it failed.</summary>
    public async Task<(int Code, string Message)> Login(string email, string password, bool remember)
    {
        await _gate.WaitAsync();
        try
        {
            using var req = new HttpRequestMessage(HttpMethod.Post, new Uri(Api, "login"))
            { Content = new StringContent(JsonSerializer.Serialize(new { email = email.Trim(), password }), Encoding.UTF8, "application/json") };
            req.Headers.TryAddWithoutValidation("Origin", "https://bfrevive.net");
            req.Headers.Referrer = new Uri("https://bfrevive.net/my-summoner/");
            using var res = await _http.SendAsync(req);
            var body = await res.Content.ReadAsStringAsync();
            string? name = null, error = null;
            try
            {
                using var doc = JsonDocument.Parse(body);
                if (doc.RootElement.TryGetProperty("data", out var d) && d.ValueKind == JsonValueKind.Object && d.TryGetProperty("name", out var n)) name = n.GetString();
                if (doc.RootElement.TryGetProperty("error", out var er)) error = er.ValueKind == JsonValueKind.String ? er.GetString() : er.ValueKind == JsonValueKind.Object && er.TryGetProperty("message", out var m) ? m.GetString() : null;
            }
            catch { }
            _log($"summoner login -> {(int)res.StatusCode}");
            if (!res.IsSuccessStatusCode) { Name = null; return ((int)res.StatusCode, error ?? "Sign-in failed."); }
            Name = name ?? "Summoner";
            _cache.Clear();
            if (remember) Save(email, password); else Forget();
            return (200, "");
        }
        catch (Exception ex) { _log("summoner login failed: " + ex.Message); return (0, "My Summoner could not be reached."); }
        finally { _gate.Release(); }
    }

    /// <summary>Signs in again with the remembered login (start of the program, or an expired session).</summary>
    /// Several parts are asked for at once; they share ONE sign-in instead of each starting its own.
    public Task<bool> Resume()
    {
        lock (_resumeLock) { if (_resuming == null || _resuming.IsCompleted) _resuming = ResumeOnce(); return _resuming; }
    }
    private Task<bool>? _resuming;
    private readonly object _resumeLock = new();
    private async Task<bool> ResumeOnce()
    {
        var saved = Load();
        if (saved == null) return false;
        var (code, _) = await Login(saved.Value.Email, saved.Value.Password, true);
        if (code == 401) Forget();   // the remembered password no longer works
        return code == 200;
    }

    public async Task Logout(bool forget)
    {
        await _gate.WaitAsync();
        try
        {
            if (SignedIn)
                try { using var req = new HttpRequestMessage(HttpMethod.Post, new Uri(Api, "logout")) { Content = new StringContent("{}", Encoding.UTF8, "application/json") }; using var res = await _http.SendAsync(req); } catch { }
            Name = null; _cache.Clear();
            if (forget) Forget();
        }
        finally { _gate.Release(); }
    }

    /// <summary>One account part as the service's own JSON. 404 for a part not on the list, 401 when not signed in.</summary>
    public async Task<(int Code, byte[] Body)> Get(string part, bool fresh)
    {
        if (!PartOk.IsMatch(part)) return (404, Encoding.UTF8.GetBytes("unknown part"));
        if (!SignedIn && !(Saved && await Resume())) return (401, Encoding.UTF8.GetBytes("not signed in"));
        for (var attempt = 0; ; attempt++)
        {
            await _gate.WaitAsync();
            int code; byte[] body;
            try
            {
                if (!fresh && _cache.TryGetValue(part, out var c) && DateTime.UtcNow - c.At < Keep) return (200, c.Body);
                using var res = await _http.GetAsync(new Uri(Api, part));
                code = (int)res.StatusCode; body = await res.Content.ReadAsByteArrayAsync();
                _log($"summoner {part} -> {code}, {body.Length} bytes");
                if (code == 200) { _cache[part] = (DateTime.UtcNow, body); return (200, body); }
            }
            catch (Exception ex) { _log($"summoner {part} failed: {ex.Message}"); return (0, Encoding.UTF8.GetBytes("My Summoner could not be reached.")); }
            finally { _gate.Release(); }
            if (code == 401 && attempt == 0 && Saved && await Resume()) continue;   // the session ran out: sign in once more
            if (code == 401) Name = null;
            return (code, body);
        }
    }

    // ---- the remembered login: one small file, readable only by this Windows user
    private void Save(string email, string password)
    {
        try { File.WriteAllBytes(_file, ProtectedData.Protect(Encoding.UTF8.GetBytes(JsonSerializer.Serialize(new[] { email.Trim(), password })), null, DataProtectionScope.CurrentUser)); }
        catch (Exception ex) { _log("summoner: could not remember the login: " + ex.Message); }
    }
    private (string Email, string Password)? Load()
    {
        try
        {
            if (!File.Exists(_file)) return null;
            var a = JsonSerializer.Deserialize<string[]>(Encoding.UTF8.GetString(ProtectedData.Unprotect(File.ReadAllBytes(_file), null, DataProtectionScope.CurrentUser)));
            return a is { Length: 2 } ? (a[0], a[1]) : null;
        }
        catch { return null; }
    }
    private void Forget() { try { File.Delete(_file); } catch { } }
}
