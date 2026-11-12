using System.Diagnostics;
using System.IO;
using System.Runtime.InteropServices;
using System.Text.Json;
using System.Web;
using System.Windows;
using System.Windows.Controls;
using System.Windows.Interop;
using Microsoft.Web.WebView2.Core;
using Microsoft.Web.WebView2.Wpf;

namespace BfrDeck;

public partial class MainWindow : Window
{
    private const string DeckHost = "app.bfrdeck";
    private const string ApiHost = "api.bfrdeck";   // not folder-mapped, so WebResourceRequested owns it
    private const string Cors = "Access-Control-Allow-Origin: https://app.bfrdeck";

    // (key, label, url). The first entry is the local deck; the rest are embedded public tools.
    private static readonly (string Key, string Label, string Url)[] TabDefs =
    {
        ("deck",      "Deck",         $"https://{DeckHost}/index.html"),
        ("site",      "BFRevived",    "https://bfrevive.net/"),
        ("wiki",      "Wiki",         "https://bravefrontierglobal.fandom.com/wiki/Brave_Frontier_Wiki"),
    };

    private readonly Dictionary<string, WebView2> _views = new();
    private readonly Dictionary<string, RadioButton> _tabs = new();
    private readonly DataCache _cache = new();
    private readonly string _dataDir;
    private string _wwwroot;
    private string? _webVersion;       // set when the UI comes from a web update (see Updater)
    private readonly Updater _updater;
    private CoreWebView2Environment? _env;
    private string _current = "deck";
    private Settings _settings = new();

    public MainWindow()
    {
        InitializeComponent();
        _dataDir = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "BfrDeck");
        Directory.CreateDirectory(_dataDir);
        _wwwroot = ResolveWwwroot();
        Housekeeping();
        _updater = new Updater(_dataDir, _webVersion, Log) { WebReady = UseWebUpdate, RestartReady = () => Dispatcher.Invoke(() => { if (_updater!.Restart()) Close(); }) };
        LoadSettings();
        foreach (var t in TabDefs)
        {
            var rb = new RadioButton { Content = t.Label, Style = (Style)FindResource("Tab"), GroupName = "tabs", Tag = t.Key };
            rb.Checked += (_, _) => Show(t.Key);
            Tabs.Children.Add(rb);
            _tabs[t.Key] = rb;
        }
        Loaded += async (_, _) => { StartLiveLoop(); await InitAsync(); };
        Closing += (_, _) => SaveSettings();
        SourceInitialized += (_, _) => DarkTitleBar();
    }

    // Keep %LOCALAPPDATA%\BfrDeck tidy at every start: the log is cut to its last 3,000 lines once it passes 2 MB,
    // leftover debug frames and OCR crops are removed unless debugging is on, and old unpacked UI versions go.
    private void Housekeeping()
    {
        try
        {
            var log = Path.Combine(_dataDir, "log.txt");
            if (File.Exists(log) && new FileInfo(log).Length > 2 * 1024 * 1024)
            {
                var lines = File.ReadAllLines(log);
                File.WriteAllLines(log, lines.Skip(Math.Max(0, lines.Length - 3000)));
            }
            if (!Environment.GetCommandLineArgs().Contains("--debugframes"))
                foreach (var f in Directory.EnumerateFiles(_dataDir, "*.png")) { try { File.Delete(f); } catch { } }
            var www = Path.Combine(_dataDir, "wwwroot");
            var keep = Path.GetFileName(_wwwroot);
            if (Directory.Exists(www))
                foreach (var d in Directory.EnumerateDirectories(www)) if (Path.GetFileName(d) != keep) { try { Directory.Delete(d, true); } catch { } }
        }
        catch { }
    }

    // The UI files: the wwwroot folder next to the exe when there is one (dev build), otherwise the copy embedded in
    // the single-file exe, unpacked once per version into %LOCALAPPDATA%\BfrDeck\wwwroot\<version>.
    private string ResolveWwwroot()
    {
        var beside = Path.Combine(AppContext.BaseDirectory, "wwwroot");
        if (File.Exists(Path.Combine(beside, "index.html"))) return beside;
        // a web update on top of this exe wins over the UI inside it
        if (Updater.InstalledWeb(_dataDir) is { } web) { _webVersion = web.Version; return web.Dir; }
        // Keyed by version and build id (the module's MVID changes with every build), so a rebuilt exe of the same
        // version never serves a stale unpacked UI. Housekeeping removes the older folders.
        var asm = typeof(MainWindow).Assembly;
        var ver = asm.GetName().Version?.ToString(3) ?? "0";
        var dir = Path.Combine(_dataDir, "wwwroot", ver + "-" + asm.ManifestModule.ModuleVersionId.ToString("N").Substring(0, 8));
        var names = asm.GetManifestResourceNames().Where(n => n.StartsWith("wwwroot/")).ToArray();
        if (!File.Exists(Path.Combine(dir, "index.html")) || !File.Exists(Path.Combine(dir, ".complete")))
        {
            try
            {
                foreach (var n in names)
                {
                    var rel = n.Substring("wwwroot/".Length).Replace('/', Path.DirectorySeparatorChar);
                    var target = Path.Combine(dir, rel);
                    Directory.CreateDirectory(Path.GetDirectoryName(target)!);
                    using var src = asm.GetManifestResourceStream(n)!;
                    using var dst = File.Create(target);
                    src.CopyTo(dst);
                }
                File.WriteAllText(Path.Combine(dir, ".complete"), DateTime.UtcNow.ToString("o"));
            }
            catch (Exception ex) { Log("unpack wwwroot failed: " + ex.Message); }
        }
        return dir;
    }

    // The caption is drawn by WindowChrome; this only darkens the thin DWM border around the window.
    private void DarkTitleBar()
    {
        var hwnd = new WindowInteropHelper(this).Handle;
        int on = 1;
        DwmSetWindowAttribute(hwnd, 20 /* DWMWA_USE_IMMERSIVE_DARK_MODE */, ref on, sizeof(int));
        int border = 0x0024110e;   // COLORREF of #0e1124 (title bar colour)
        DwmSetWindowAttribute(hwnd, 34 /* DWMWA_BORDER_COLOR */, ref border, sizeof(int));
    }
    [DllImport("dwmapi.dll")] private static extern int DwmSetWindowAttribute(IntPtr hwnd, int attr, ref int value, int size);

    private async Task InitAsync()
    {
        var userData = Path.Combine(_dataDir, "webview");
        var opts = new CoreWebView2EnvironmentOptions { AdditionalBrowserArguments = "--disable-features=msSmartScreenProtection" };
        _env = await CoreWebView2Environment.CreateAsync(null, userData, opts);
        Topmost = _settings.Pinned;
        UpdatePinLabel();
        _tabs["deck"].IsChecked = true;
        if (Environment.GetCommandLineArgs().Contains("--dock")) Dock_Click(this, new RoutedEventArgs());
    }

    private async void Show(string key)
    {
        if (_env == null) return;
        _current = key;
        foreach (var kv in _views) kv.Value.Visibility = kv.Key == key ? Visibility.Visible : Visibility.Collapsed;
        if (!_views.TryGetValue(key, out var wv))
        {
            wv = new WebView2 { DefaultBackgroundColor = System.Drawing.Color.FromArgb(0x0b, 0x0d, 0x1a) };
            _views[key] = wv;
            Host.Children.Add(wv);
            await wv.EnsureCoreWebView2Async(_env);
            var core = wv.CoreWebView2;
            core.Settings.AreDefaultContextMenusEnabled = true;
            core.Settings.IsStatusBarEnabled = false;
            core.Settings.AreDevToolsEnabled = true;
            core.NewWindowRequested += (_, e) => { e.Handled = true; OpenInBrowser(e.Uri); };
            if (key == "deck") SetupDeck(core);
            var def = TabDefs.First(t => t.Key == key);
            var url = def.Url;
            if (key == "deck")
            {
                // BfrDeck.exe --deck "#/units/10017" opens the deck on that route (handy for testing).
                var args = Environment.GetCommandLineArgs();
                var i = Array.IndexOf(args, "--deck");
                if (i >= 0 && i + 1 < args.Length) url += args[i + 1];
            }
            core.Navigate(url);
        }
        var isDeck = key == "deck";
        BtnBack.Visibility = isDeck ? Visibility.Collapsed : Visibility.Visible;
        BtnReload.Visibility = Visibility.Visible;
    }

    private async void SetupDeck(CoreWebView2 core)
    {
        Log("deck starting; wwwroot=" + _wwwroot);
        core.SetVirtualHostNameToFolderMapping(DeckHost, _wwwroot, CoreWebView2HostResourceAccessKind.DenyCors);
        core.AddWebResourceRequestedFilter($"https://{ApiHost}/*", CoreWebView2WebResourceContext.All);
        core.WebResourceRequested += OnDeckRequest;
        core.WebMessageReceived += OnWebMessage;
        // Page errors go to %LOCALAPPDATA%\BfrDeck\log.txt so problems can be diagnosed without DevTools.
        try
        {
            await core.CallDevToolsProtocolMethodAsync("Runtime.enable", "{}");
            core.GetDevToolsProtocolEventReceiver("Runtime.exceptionThrown").DevToolsProtocolEventReceived += (_, e) => Log("JS exception: " + e.ParameterObjectAsJson);
            core.GetDevToolsProtocolEventReceiver("Runtime.consoleAPICalled").DevToolsProtocolEventReceived += (_, e) =>
            {
                using var d = JsonDocument.Parse(e.ParameterObjectAsJson);
                var type = d.RootElement.GetProperty("type").GetString();
                if (type is "error" or "warning") Log($"console.{type}: {e.ParameterObjectAsJson}");
            };
        }
        catch (Exception ex) { Log("devtools hook failed: " + ex.Message); }
    }

    // A web update is unpacked: serve the deck from its folder and load it anew (no restart of the program).
    private Task UseWebUpdate(string dir) => Dispatcher.InvokeAsync(async () =>
    {
        _wwwroot = dir;
        if (!_views.TryGetValue("deck", out var wv) || wv.CoreWebView2 == null) return;
        var core = wv.CoreWebView2;
        core.SetVirtualHostNameToFolderMapping(DeckHost, dir, CoreWebView2HostResourceAccessKind.DenyCors);
        try { await core.CallDevToolsProtocolMethodAsync("Network.clearBrowserCache", "{}"); } catch { }
        Log("deck reloading; wwwroot=" + dir);
        core.Reload();
    }).Task.Unwrap();

    private readonly object _logLock = new();
    private void Log(string line)
    {
        try { lock (_logLock) File.AppendAllText(Path.Combine(_dataDir, "log.txt"), $"{DateTime.Now:HH:mm:ss} {line}\n"); } catch { }
    }

    // Serves /proxy?u=<url> (cached JSON from bfrevive.net) and /api/status (emulator session info).
    private async void OnDeckRequest(object? sender, CoreWebView2WebResourceRequestedEventArgs e)
    {
        var deferral = e.GetDeferral();
        try
        {
            var uri = new Uri(e.Request.Uri);
            if (e.Request.Method == "OPTIONS")
            {   // CORS preflight for the POST endpoints (the page origin is app.bfrdeck, the API host api.bfrdeck)
                e.Response = _env!.CreateWebResourceResponse(new MemoryStream(), 204, "No Content", $"{Cors}\nAccess-Control-Allow-Methods: GET, POST, OPTIONS\nAccess-Control-Allow-Headers: Content-Type\nAccess-Control-Max-Age: 86400");
                return;
            }
            if (uri.AbsolutePath == "/api/frame")
            {
                // A frame of the emulator for the unit scanner. src=window (default): a desktop grab of the emulator
                // window's game area, a few milliseconds, works with any emulator. src=adb: the screencap the live
                // reader uses (full 1080x1920, slower). Both are read-only.
                var qs = HttpUtility.ParseQueryString(uri.Query);
                // src=file replays the last saved scan frame (offline test of the matcher).
                byte[]? png = qs["src"] == "file" ? (File.Exists(Path.Combine(_dataDir, "scan-last.png")) ? File.ReadAllBytes(Path.Combine(_dataDir, "scan-last.png")) : null)
                    : qs["src"] == "adb" ? await _live.FrameAsync() : GrabEmulatorWindow() ?? await _live.FrameAsync();
                if (png == null) { e.Response = Error(503, "no frame: no emulator window found and no adb screen"); return; }
                if (qs["save"] == "1") try { File.WriteAllBytes(Path.Combine(_dataDir, "scan-last.png"), png); } catch { }
                e.Response = _env!.CreateWebResourceResponse(new MemoryStream(png), 200, "OK", $"Content-Type: image/png\nCache-Control: no-store\n{Cors}");
                return;
            }
            if (uri.AbsolutePath == "/api/ocr" && e.Request.Content != null)
            {
                // POST a small PNG, get its text (Windows OCR). Used for the "×N" duplicate badges in the unit list.
                using var ms0 = new MemoryStream(); e.Request.Content.CopyTo(ms0);
                var saveN = HttpUtility.ParseQueryString(uri.Query)["save"];
                if (saveN != null) try { File.WriteAllBytes(Path.Combine(_dataDir, $"badge-{saveN}.png"), ms0.ToArray()); } catch { }
                var text = await _live.OcrTextAsync(ms0.ToArray());
                e.Response = Json(JsonSerializer.Serialize(new { text }));
                return;
            }
            if (uri.AbsolutePath.StartsWith("/api/update"))
            {
                // /api/update: state; /check: ask the releases page; /apply: download and install in the background
                // (the page polls /api/update for the progress; when done the host reloads the page or restarts)
                if (uri.AbsolutePath == "/api/update/check") await _updater.Check();
                else if (uri.AbsolutePath == "/api/update/apply") _ = Task.Run(_updater.Apply);
                e.Response = Json(JsonSerializer.Serialize(_updater.Status()));
                return;
            }
            if (uri.AbsolutePath.StartsWith("/api/"))
            {
                e.Response = Json(JsonSerializer.Serialize(ApiStatus()));
                return;
            }
            var target = HttpUtility.ParseQueryString(uri.Query)["u"];
            var fresh = HttpUtility.ParseQueryString(uri.Query)["fresh"] == "1";
            if (string.IsNullOrEmpty(target)) { e.Response = Error(400, "missing u"); return; }
            var r = await _cache.GetAsync(target, fresh);
            Log($"proxy {target} -> {(r == null ? "FAIL" : $"{r.Bytes.Length} bytes, age {r.AgeSeconds}s, stale {r.Stale}")}");
            if (r == null) { e.Response = Error(502, "fetch failed"); return; }
            var headers = $"Content-Type: {r.ContentType}\nX-Cache-Age: {r.AgeSeconds}\nX-Stale: {(r.Stale ? 1 : 0)}\nAccess-Control-Expose-Headers: X-Stale, X-Cache-Age\n{Cors}";
            e.Response = _env!.CreateWebResourceResponse(new MemoryStream(r.Bytes), 200, "OK", headers);
        }
        catch (Exception ex)
        {
            Log($"proxy error {e.Request.Uri}: {ex}");
            e.Response = Error(500, ex.Message);
        }
        finally { deferral.Complete(); }
    }

    // Desktop grab of the emulator's game area: the docked window if docked, else the first known emulator window.
    // The game is portrait 9:16; the largest 9:16 box centred in the client area is taken as the viewport, which
    // trims an emulator's title bar and side toolbars. Returns PNG bytes, or null when there is no such window.
    private byte[]? GrabEmulatorWindow()
    {
        try
        {
            var hwnd = Docked ? _dockHwnd : FindEmulatorWindow();
            if (hwnd == IntPtr.Zero || !IsWindow(hwnd) || IsIconic(hwnd)) return null;
            if (!GetClientRect(hwnd, out var cr)) return null;
            var tl = new POINT { X = cr.Left, Y = cr.Top }; ClientToScreen(hwnd, ref tl);
            int cw = cr.Right - cr.Left, ch = cr.Bottom - cr.Top;
            if (cw < 200 || ch < 300) return null;
            using var full = new System.Drawing.Bitmap(cw, ch, System.Drawing.Imaging.PixelFormat.Format24bppRgb);
            using (var g = System.Drawing.Graphics.FromImage(full)) g.CopyFromScreen(tl.X, tl.Y, 0, 0, full.Size);
            // Emulator chrome drawn inside the client area (BlueStacks' top bar, LDPlayer's side bar) is flat; trim
            // bands whose pixels barely vary, then take the largest 9:16 box centred in what is left.
            var (l, t, r, b) = TrimFlatBands(full);
            // BlueStacks draws its own title bar (icons, so not flat) inside the client area: 35 logical px.
            GetWindowThreadProcessId(hwnd, out var pid);
            string pname = ""; try { pname = Process.GetProcessById((int)pid).ProcessName; } catch { }
            if (pname.Equals("HD-Player", StringComparison.OrdinalIgnoreCase)) t = Math.Max(t, (int)Math.Round(35 * GetDpiForWindow(hwnd) / 96.0));
            int aw = r - l, ah = b - t;
            int vw = aw, vh = aw * 16 / 9;
            if (vh > ah) { vh = ah; vw = ah * 9 / 16; }
            int vx = l + (aw - vw) / 2, vy = t + (ah - vh) / 2;
            using var bmp = full.Clone(new System.Drawing.Rectangle(vx, vy, vw, vh), full.PixelFormat);
            using var ms = new MemoryStream();
            bmp.Save(ms, System.Drawing.Imaging.ImageFormat.Png);
            return ms.ToArray();
        }
        catch (Exception ex) { Log("window grab failed: " + ex.Message); return null; }
    }
    // Returns the bounds of the non-flat content: rows/columns at the edges whose brightness varies by less than a
    // small amount across their length are considered emulator chrome and cut off (sampled every 4th pixel).
    private static (int l, int t, int r, int b) TrimFlatBands(System.Drawing.Bitmap bmp)
    {
        var data = bmp.LockBits(new System.Drawing.Rectangle(0, 0, bmp.Width, bmp.Height), System.Drawing.Imaging.ImageLockMode.ReadOnly, System.Drawing.Imaging.PixelFormat.Format24bppRgb);
        try
        {
            unsafe
            {
                var p = (byte*)data.Scan0; int stride = data.Stride, W = bmp.Width, H = bmp.Height;
                bool RowFlat(int y) { int mn = 255, mx = 0; for (int x = 0; x < W; x += 4) { var i = y * stride + x * 3; var v = (p[i] + p[i + 1] + p[i + 2]) / 3; if (v < mn) mn = v; if (v > mx) mx = v; } return mx - mn < 40; }
                bool ColFlat(int x) { int mn = 255, mx = 0; for (int y = 0; y < H; y += 4) { var i = y * stride + x * 3; var v = (p[i] + p[i + 1] + p[i + 2]) / 3; if (v < mn) mn = v; if (v > mx) mx = v; } return mx - mn < 40; }
                int t = 0, b = H, l = 0, r = W;
                while (t < H / 4 && RowFlat(t)) t++;
                while (b > H * 3 / 4 && RowFlat(b - 1)) b--;
                while (l < W / 4 && ColFlat(l)) l++;
                while (r > W * 3 / 4 && ColFlat(r - 1)) r--;
                return (l, t, r, b);
            }
        }
        finally { bmp.UnlockBits(data); }
    }
    [DllImport("user32.dll")] private static extern uint GetDpiForWindow(IntPtr hWnd);
    [DllImport("user32.dll")] private static extern bool GetClientRect(IntPtr hWnd, out RECT rect);
    [DllImport("user32.dll")] private static extern bool ClientToScreen(IntPtr hWnd, ref POINT pt);
    [StructLayout(LayoutKind.Sequential)] private struct POINT { public int X, Y; }

    private CoreWebView2WebResourceResponse Json(string body) =>
        _env!.CreateWebResourceResponse(new MemoryStream(System.Text.Encoding.UTF8.GetBytes(body)), 200, "OK", $"Content-Type: application/json\n{Cors}");
    private CoreWebView2WebResourceResponse Error(int code, string msg) =>
        _env!.CreateWebResourceResponse(new MemoryStream(System.Text.Encoding.UTF8.GetBytes(msg)), code, "Error", $"Content-Type: text/plain\n{Cors}");

    private object ApiStatus()
    {
        var p = Process.GetProcessesByName("HD-Player").FirstOrDefault();
        DateTime? started = null;
        try { if (p != null) started = p.StartTime.ToUniversalTime(); } catch { }
        return new { bluestacks = p != null, startedUtc = started?.ToString("o"), nowUtc = DateTime.UtcNow.ToString("o"), live = _live.Enabled ? _live.Last : null };
    }

    // Live reader loop: when enabled and BlueStacks runs, read the header every 8 s.
    private LiveReader _live = null!;
    private async void StartLiveLoop()
    {
        _live = new LiveReader(Log) { Enabled = _settings.Live };
        var args = Environment.GetCommandLineArgs();
        if (args.Contains("--debugframes")) _live.DebugDir = _dataDir;   // keep frame-last.png and the OCR crops for tuning
        var i = Array.IndexOf(args, "--ocrtest");
        if (i >= 0 && i + 1 < args.Length)
        {
            _live.DebugDir = _dataDir;
            var r = await _live.ReadFrameAsync(File.ReadAllBytes(args[i + 1]));
            Log("ocrtest: " + JsonSerializer.Serialize(r));
            Application.Current.Shutdown();
            return;
        }
        while (true)
        {
            try
            {
                if (_live.Enabled && Process.GetProcessesByName("HD-Player").Length > 0) await _live.ReadAsync();
            }
            catch (Exception ex) { Log("live loop: " + ex.Message); }
            await Task.Delay(8000);
        }
    }

    private void OnWebMessage(object? sender, CoreWebView2WebMessageReceivedEventArgs e)
    {
        try
        {
            using var doc = JsonDocument.Parse(e.WebMessageAsJson);
            var root = doc.RootElement;
            var cmd = root.GetProperty("cmd").GetString();
            switch (cmd)
            {
                case "open":
                {
                    var tab = root.GetProperty("tab").GetString() ?? "site";
                    var url = root.GetProperty("url").GetString() ?? "";
                    if (!_tabs.ContainsKey(tab)) tab = "site";
                    _tabs[tab].IsChecked = true;
                    if (_views.TryGetValue(tab, out var wv) && wv.CoreWebView2 != null && url != "") wv.CoreWebView2.Navigate(url);
                    else _pendingNav[tab] = url;
                    break;
                }
                case "browser":
                    OpenInBrowser(root.GetProperty("url").GetString() ?? "");
                    break;
                case "dock": Dock_Click(this, new RoutedEventArgs()); break;
                case "pin": Pin_Click(this, new RoutedEventArgs()); break;
                case "liveon": _live.Enabled = true; _settings.Live = true; SaveSettings(); break;
                case "liveoff": _live.Enabled = false; _settings.Live = false; SaveSettings(); break;
                case "debugframes": _live.DebugDir = _live.DebugDir == null ? _dataDir : null; Log("debug frames " + (_live.DebugDir != null ? "on: " + _dataDir : "off")); break;
                case "cleanframes": foreach (var f in Directory.EnumerateFiles(_dataDir, "*.png")) { try { File.Delete(f); } catch { } } break;
            }
        }
        catch { }
    }
    private readonly Dictionary<string, string> _pendingNav = new();

    private static void OpenInBrowser(string url)
    {
        if (!url.StartsWith("http")) return;
        try { Process.Start(new ProcessStartInfo(url) { UseShellExecute = true }); } catch { }
    }

    private void Min_Click(object sender, RoutedEventArgs e) => WindowState = WindowState.Minimized;
    private void Max_Click(object sender, RoutedEventArgs e)
    {
        WindowState = WindowState == WindowState.Maximized ? WindowState.Normal : WindowState.Maximized;
        BtnMax.Content = WindowState == WindowState.Maximized ? "" : "";
    }
    private void Close_Click(object sender, RoutedEventArgs e) => Close();

    private void Back_Click(object sender, RoutedEventArgs e)
    {
        if (_views.TryGetValue(_current, out var wv) && wv.CoreWebView2?.CanGoBack == true) wv.CoreWebView2.GoBack();
    }
    private void Reload_Click(object sender, RoutedEventArgs e)
    {
        if (_views.TryGetValue(_current, out var wv)) wv.CoreWebView2?.Reload();
    }
    private void Pin_Click(object sender, RoutedEventArgs e)
    {
        Topmost = !Topmost;
        _settings.Pinned = Topmost;
        UpdatePinLabel();
    }
    private void UpdatePinLabel()
    {
        BtnPin.Style = (Style)FindResource(Topmost ? "ToolOn" : "Tool");
        BtnPin.Content = Topmost ? "Pinned" : "Pin";
    }

    // Dock: snap this window beside an emulator window (right side, left if there is no room) and keep the two
    // together. A WinEvent hook on the emulator's window reports every move/resize while it is being dragged, so
    // the deck follows frame by frame; when the deck is dragged, the emulator is carried along. Known emulators
    // are found by process name; otherwise (or with Shift held) the next window you click becomes the target.
    // Click Docked to undock; the dock also ends when the emulator window closes.
    private static readonly string[] EmulatorProcesses =
    {
        "HD-Player",                       // BlueStacks 5 / MSI App Player
        "dnplayer", "LdPlayer",            // LDPlayer
        "Nox", "NoxVMHandle",              // Nox
        "MEmu",                            // MEmu
        "MuMuPlayer", "MuMuNxDevice", "NemuPlayer", "MuMuVMMHeadless",   // MuMu
        "qemu-system-x86_64", "emulator",  // Android Studio emulator
        "crosvm", "Bluestacks X",          // Google Play Games beta / BlueStacks X
        "Waydroid", "GameLoop", "AndroidEmulatorEn", "aow_exe",          // GameLoop
    };
    private IntPtr _dockHwnd;
    private RECT _dockLast;            // emulator rect at the last sync
    private bool _dockSide;            // true: deck sits to the right of the emulator
    private bool _dockMoving;          // set while we move a window ourselves, so the echo is ignored
    private int _placedX = int.MinValue, _placedY;   // where we last put the deck (device px); moves to there are our own
    private IntPtr _hook;
    private WinEventDelegate? _hookProc;   // kept alive for the unmanaged callback
    private System.Windows.Threading.DispatcherTimer? _dockTimer;   // slow fallback: existence check + missed events
    private bool _picking;
    private bool Docked => _dockHwnd != IntPtr.Zero;

    private async void Dock_Click(object sender, RoutedEventArgs e)
    {
        if (Docked) { Undock(); return; }
        if (_picking) return;
        IntPtr target = IntPtr.Zero;
        var force = (System.Windows.Input.Keyboard.Modifiers & System.Windows.Input.ModifierKeys.Shift) != 0;
        if (!force) target = FindEmulatorWindow();
        if (target == IntPtr.Zero)
        {
            // Pick mode: wait up to 8 s for the user to click another window.
            _picking = true; BtnDock.Content = "Click the emulator…"; BtnDock.Style = (Style)FindResource("ToolOn");
            var me = new WindowInteropHelper(this).Handle;
            var started = DateTime.UtcNow;
            while ((DateTime.UtcNow - started).TotalSeconds < 8)
            {
                await Task.Delay(100);
                var fg = GetForegroundWindow();
                if (fg != IntPtr.Zero && fg != me && !IsOwnWindow(fg) && IsWindowVisible(fg)) { target = GetAncestor(fg, GA_ROOT); break; }
            }
            _picking = false;
            if (target == IntPtr.Zero) { Undock(); toastHost("No window picked. Click Dock, then click the emulator window."); return; }
        }
        if (!GetWindowRect(target, out var r)) { Undock(); return; }
        _dockHwnd = target;
        var m = FromDevice();
        var screenW = SystemParameters.VirtualScreenWidth + SystemParameters.VirtualScreenLeft;
        _dockSide = m.Transform(new Point(r.Right, 0)).X + Width <= screenW;
        WindowState = WindowState.Normal;
        SnapTo(r);
        Activate();
        // Hook only the emulator's thread; EVENT_OBJECT_LOCATIONCHANGE fires for each step of a drag or resize.
        GetWindowThreadProcessId(target, out var pid);
        _hookProc ??= OnWinEvent;
        if (_hook != IntPtr.Zero) UnhookWinEvent(_hook);
        _hook = SetWinEventHook(EVENT_OBJECT_DESTROY, EVENT_OBJECT_LOCATIONCHANGE, IntPtr.Zero, _hookProc, pid, 0, WINEVENT_OUTOFCONTEXT);
        _dockTimer ??= new System.Windows.Threading.DispatcherTimer { Interval = TimeSpan.FromMilliseconds(500) };
        _dockTimer.Tick -= DockTick; _dockTimer.Tick += DockTick; _dockTimer.Start();
        LocationChanged -= DeckMoved; LocationChanged += DeckMoved;
        BtnDock.Style = (Style)FindResource("ToolOn"); BtnDock.Content = "Docked";
        BtnDock.ToolTip = $"Docked to \"{WindowTitle(target)}\". Click to undock.";
        Log($"dock: {WindowTitle(target)} pid {pid} side {(_dockSide ? "right" : "left")}");
    }
    private void Undock()
    {
        _dockHwnd = IntPtr.Zero; _dockTimer?.Stop(); LocationChanged -= DeckMoved;
        if (_hook != IntPtr.Zero) { UnhookWinEvent(_hook); _hook = IntPtr.Zero; }
        BtnDock.Style = (Style)FindResource("Tool"); BtnDock.Content = "Dock"; BtnDock.ToolTip = "Snap beside the emulator window (Shift+click: pick any window)";
    }
    private IntPtr FindEmulatorWindow()
    {
        foreach (var name in EmulatorProcesses)
            foreach (var p in Process.GetProcessesByName(name))
                if (p.MainWindowHandle != IntPtr.Zero && IsWindowVisible(p.MainWindowHandle)) return p.MainWindowHandle;
        return IntPtr.Zero;
    }
    private bool IsOwnWindow(IntPtr h) { GetWindowThreadProcessId(h, out var pid); return pid == Environment.ProcessId; }
    private static string WindowTitle(IntPtr h) { var sb = new System.Text.StringBuilder(256); GetWindowText(h, sb, sb.Capacity); return sb.ToString(); }
    private void toastHost(string msg) { try { if (_views.TryGetValue("deck", out var wv)) wv.CoreWebView2?.ExecuteScriptAsync($"toast({JsonSerializer.Serialize(msg)})"); } catch { } }
    private System.Windows.Media.Matrix FromDevice() => PresentationSource.FromVisual(this)?.CompositionTarget?.TransformFromDevice ?? System.Windows.Media.Matrix.Identity;
    private System.Windows.Media.Matrix ToDevice() => PresentationSource.FromVisual(this)?.CompositionTarget?.TransformToDevice ?? System.Windows.Media.Matrix.Identity;

    // Place the deck beside the emulator rect (device pixels), matching its height. Goes through SetWindowPos
    // directly so the move lands in the same frame as the emulator's.
    private void SnapTo(RECT r)
    {
        var d = ToDevice();
        int wDev = (int)Math.Round(d.Transform(new Point(Width, 0)).X);
        int minH = (int)Math.Round(d.Transform(new Point(0, MinHeight)).Y);
        int x = _dockSide ? r.Right : r.Left - wDev;
        int y = r.Top, hDev = Math.Max(minH, r.Bottom - r.Top);
        var me = new WindowInteropHelper(this).Handle;
        _dockMoving = true;
        try { SetWindowPos(me, IntPtr.Zero, x, y, wDev, hDev, SWP_NOZORDER | SWP_NOACTIVATE); }
        finally { _dockMoving = false; }
        _placedX = x; _placedY = y; _dockLast = r;
    }
    private void OnWinEvent(IntPtr hook, uint evt, IntPtr hwnd, int idObject, int idChild, uint thread, uint time)
    {
        if (hwnd != _dockHwnd || idObject != OBJID_WINDOW) return;
        if (evt == EVENT_OBJECT_DESTROY) { Undock(); return; }
        FollowNow();
    }
    private void FollowNow()
    {
        if (!Docked) return;
        if (!IsWindow(_dockHwnd) || !GetWindowRect(_dockHwnd, out var r)) { Undock(); return; }
        if (r.Left == _dockLast.Left && r.Top == _dockLast.Top && r.Right == _dockLast.Right && r.Bottom == _dockLast.Bottom) return;
        if (IsIconic(_dockHwnd) || WindowState != WindowState.Normal) { _dockLast = r; return; }
        SnapTo(r);
    }
    private void DockTick(object? sender, EventArgs e) => FollowNow();
    // The deck was dragged by the user: carry the emulator along so the pair stays glued.
    private void DeckMoved(object? sender, EventArgs e)
    {
        if (!Docked || _dockMoving || WindowState != WindowState.Normal) return;
        var d = ToDevice();
        var mine = d.Transform(new Point(Left, Top));
        int mx = (int)Math.Round(mine.X), my = (int)Math.Round(mine.Y);
        if (Math.Abs(mx - _placedX) <= 1 && Math.Abs(my - _placedY) <= 1) return;   // echo of our own SnapTo
        if (!GetWindowRect(_dockHwnd, out var r)) return;
        int w = r.Right - r.Left;
        int x = _dockSide ? mx - w : (int)Math.Round(d.Transform(new Point(Left + Width, 0)).X);
        int y = my;
        if (x == r.Left && y == r.Top) return;
        _dockMoving = true;
        try { SetWindowPos(_dockHwnd, IntPtr.Zero, x, y, 0, 0, SWP_NOSIZE | SWP_NOZORDER | SWP_NOACTIVATE); }
        finally { _dockMoving = false; }
        GetWindowRect(_dockHwnd, out _dockLast); _placedX = mx; _placedY = my;
    }
    private const uint SWP_NOSIZE = 0x0001, SWP_NOZORDER = 0x0004, SWP_NOACTIVATE = 0x0010;
    private const uint EVENT_OBJECT_DESTROY = 0x8001, EVENT_OBJECT_LOCATIONCHANGE = 0x800B, WINEVENT_OUTOFCONTEXT = 0;
    private const int OBJID_WINDOW = 0; private const uint GA_ROOT = 2;
    private delegate void WinEventDelegate(IntPtr hook, uint evt, IntPtr hwnd, int idObject, int idChild, uint thread, uint time);
    [DllImport("user32.dll")] private static extern IntPtr SetWinEventHook(uint min, uint max, IntPtr mod, WinEventDelegate proc, uint pid, uint tid, uint flags);
    [DllImport("user32.dll")] private static extern bool UnhookWinEvent(IntPtr hook);
    [DllImport("user32.dll")] private static extern bool SetWindowPos(IntPtr hWnd, IntPtr hWndInsertAfter, int x, int y, int cx, int cy, uint flags);
    [DllImport("user32.dll")] private static extern bool IsWindow(IntPtr hWnd);
    [DllImport("user32.dll")] private static extern bool IsIconic(IntPtr hWnd);
    [DllImport("user32.dll")] private static extern bool IsWindowVisible(IntPtr hWnd);
    [DllImport("user32.dll")] private static extern IntPtr GetForegroundWindow();
    [DllImport("user32.dll")] private static extern IntPtr GetAncestor(IntPtr hWnd, uint flags);
    [DllImport("user32.dll")] private static extern uint GetWindowThreadProcessId(IntPtr hWnd, out uint pid);
    [DllImport("user32.dll", CharSet = CharSet.Unicode)] private static extern int GetWindowText(IntPtr hWnd, System.Text.StringBuilder text, int max);

    private string SettingsPath => Path.Combine(_dataDir, "settings.json");
    private void LoadSettings()
    {
        try
        {
            if (File.Exists(SettingsPath))
                _settings = JsonSerializer.Deserialize<Settings>(File.ReadAllText(SettingsPath)) ?? new Settings();
        }
        catch { _settings = new Settings(); }
        if (_settings.Width > 300) { Width = Math.Max(MinWidth, _settings.Width); Height = Math.Max(MinHeight, _settings.Height); }
        if (_settings.Left is double l && _settings.Top is double t &&
            l >= SystemParameters.VirtualScreenLeft - 50 && l < SystemParameters.VirtualScreenLeft + SystemParameters.VirtualScreenWidth - 100)
        { Left = l; Top = t; }
        else { Left = SystemParameters.WorkArea.Right - Width - 20; Top = SystemParameters.WorkArea.Top + 20; }
    }
    private void SaveSettings()
    {
        try
        {
            if (WindowState == WindowState.Normal)
            { _settings.Left = Left; _settings.Top = Top; _settings.Width = Width; _settings.Height = Height; }
            _settings.Pinned = Topmost;
            File.WriteAllText(SettingsPath, JsonSerializer.Serialize(_settings));
        }
        catch { }
    }

    [DllImport("user32.dll")] private static extern bool GetWindowRect(IntPtr hWnd, out RECT lpRect);
    [StructLayout(LayoutKind.Sequential)] private struct RECT { public int Left, Top, Right, Bottom; }

    private sealed class Settings
    {
        public double? Left { get; set; }
        public double? Top { get; set; }
        public double Width { get; set; }
        public double Height { get; set; }
        public bool Pinned { get; set; } = true;
        public bool Live { get; set; } = false;
    }
}
