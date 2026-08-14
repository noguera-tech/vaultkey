package com.nogueratech.vaultkey;

import android.annotation.SuppressLint;
import android.accounts.Account;
import android.app.Activity;
import android.app.PendingIntent;
import android.content.Intent;
import android.content.ClipData;
import android.content.IntentSender;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.provider.Settings;
import android.provider.MediaStore;
import android.view.View;
import android.view.ViewGroup;
import android.view.WindowManager;
import android.webkit.CookieManager;
import android.webkit.ValueCallback;
import android.webkit.MimeTypeMap;
import android.webkit.SafeBrowsingResponse;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebChromeClient;
import android.webkit.WebViewClient;
import android.widget.FrameLayout;
import android.widget.Toast;

import com.google.android.gms.auth.api.identity.AuthorizationRequest;
import com.google.android.gms.auth.api.identity.AuthorizationResult;
import com.google.android.gms.auth.api.identity.Identity;
import com.google.android.gms.auth.api.identity.RevokeAccessRequest;
import com.google.android.gms.auth.api.signin.GoogleSignInAccount;
import com.google.android.gms.common.api.ApiException;
import com.google.android.gms.common.api.Scope;

import java.io.File;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.util.Collections;
import java.util.Locale;

import org.json.JSONObject;

public final class MainActivity extends Activity {
    private static final int FILE_CHOOSER_REQUEST = 4107;
    private static final int DRIVE_AUTHORIZATION_REQUEST = 4108;
    private static final String LOCAL_ORIGIN = "https://appassets.androidplatform.net";
    private static final String ASSET_PREFIX = "/assets/web/";
    private static final String NATIVE_DRIVE_CONNECT_PATH = "/native/drive/connect";
    private static final String NATIVE_DRIVE_DISCONNECT_PATH = "/native/drive/disconnect";
    private static final String NATIVE_AUTOFILL_SETTINGS_PATH = "/native/settings/autofill";
    private static final String NATIVE_SYSTEM_SETTINGS_PATH = "/native/settings/system";
    private static final String DRIVE_SCOPE = "https://www.googleapis.com/auth/drive.file";
    private static final String START_URL = LOCAL_ORIGIN + ASSET_PREFIX + "index.html";

    private WebView webView;
    private View privacyScreen;
    private boolean pageReady;
    private ValueCallback<Uri[]> fileChooserCallback;
    private Uri cameraOutputUri;
    private boolean awaitingOwnActivityResult;
    private Account driveAccount;
    private String driveAccessToken;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_SECURE);
        WebView.setWebContentsDebuggingEnabled(false);

        FrameLayout root = new FrameLayout(this);
        root.setBackgroundColor(getColorCompat(R.color.vault_background));

        webView = createWebView();
        root.addView(webView, new FrameLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.MATCH_PARENT));

        privacyScreen = createPrivacyScreen();
        root.addView(privacyScreen, new FrameLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.MATCH_PARENT));

        setContentView(root);
        coverSensitiveContent();
        webView.loadUrl(START_URL);
    }

    @SuppressLint("SetJavaScriptEnabled")
    private WebView createWebView() {
        WebView view = new WebView(this);
        view.setBackgroundColor(getColorCompat(R.color.vault_background));

        WebSettings settings = view.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setAllowFileAccess(false);
        settings.setAllowContentAccess(false);
        settings.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
        settings.setSaveFormData(false);
        settings.setSupportMultipleWindows(false);
        settings.setJavaScriptCanOpenWindowsAutomatically(false);
        settings.setGeolocationEnabled(false);
        settings.setMediaPlaybackRequiresUserGesture(true);
        settings.setUserAgentString(settings.getUserAgentString() + " VaultKeyWebViewPrototype/0.4");

        CookieManager.getInstance().setAcceptThirdPartyCookies(view, false);
        view.setWebChromeClient(new PrototypeChromeClient());
        view.setWebViewClient(new LocalAssetClient());
        return view;
    }

    private View createPrivacyScreen() {
        FrameLayout panel = new FrameLayout(this);
        panel.setBackgroundColor(getColorCompat(R.color.vault_background));
        panel.setClickable(true);
        panel.setFocusable(true);
        return panel;
    }

    private void markPageReady() {
        pageReady = true;
        revealContentIfReady();
    }

    private void revealContentIfReady() {
        if (!pageReady || !hasWindowFocus()) return;
        webView.setVisibility(View.VISIBLE);
        privacyScreen.setVisibility(View.GONE);
    }

    private void coverSensitiveContent() {
        if (privacyScreen != null) privacyScreen.setVisibility(View.VISIBLE);
        if (webView != null) {
            webView.setVisibility(View.INVISIBLE);
            if (!awaitingOwnActivityResult) {
                webView.evaluateJavascript(
                        "try{if(typeof lock==='function'){lock();}}catch(e){}", null);
            }
        }
    }

    @Override
    protected void onPause() {
        if (!awaitingOwnActivityResult) coverSensitiveContent();
        super.onPause();
    }

    @Override
    protected void onStop() {
        if (!awaitingOwnActivityResult) coverSensitiveContent();
        super.onStop();
    }

    @Override
    protected void onResume() {
        super.onResume();
        if (!awaitingOwnActivityResult) coverSensitiveContent();
    }

    @Override
    public void onWindowFocusChanged(boolean hasFocus) {
        if (!hasFocus) {
            if (!awaitingOwnActivityResult) coverSensitiveContent();
        } else {
            revealContentIfReady();
            webView.invalidate();
            webView.requestLayout();
            awaitingOwnActivityResult = false;
        }
        super.onWindowFocusChanged(hasFocus);
    }

    @Override
    protected void onDestroy() {
        coverSensitiveContent();
        if (fileChooserCallback != null) {
            fileChooserCallback.onReceiveValue(null);
            fileChooserCallback = null;
        }
        if (webView != null) {
            webView.stopLoading();
            webView.loadUrl("about:blank");
            webView.clearHistory();
            webView.removeAllViews();
            webView.destroy();
            webView = null;
        }
        super.onDestroy();
    }

    @Override
    protected void onActivityResult(int requestCode, int resultCode, Intent data) {
        if (requestCode == FILE_CHOOSER_REQUEST) {
            ValueCallback<Uri[]> callback = fileChooserCallback;
            fileChooserCallback = null;

            Uri pendingCameraUri = cameraOutputUri;
            cameraOutputUri = null;

            if (callback != null) {
                if (resultCode == RESULT_OK && pendingCameraUri != null) {
                    callback.onReceiveValue(new Uri[]{pendingCameraUri});
                } else {
                    callback.onReceiveValue(
                            WebChromeClient.FileChooserParams.parseResult(resultCode, data)
                    );
                }
            }
            return;
        }
        if (requestCode == DRIVE_AUTHORIZATION_REQUEST) {
            try {
                AuthorizationResult result = Identity.getAuthorizationClient(this)
                        .getAuthorizationResultFromIntent(data);
                deliverDriveAuthorization(result);
            } catch (ApiException error) {
                failDriveAuthorization("AutorizaciÃƒÆ’Ã‚Â³n cancelada o rechazada");
            }
            return;
        }
        super.onActivityResult(requestCode, resultCode, data);
    }

    private void beginDriveAuthorization() {
        AuthorizationRequest request = AuthorizationRequest.builder()
                .setRequestedScopes(Collections.singletonList(new Scope(DRIVE_SCOPE)))
                .build();

        Identity.getAuthorizationClient(this).authorize(request)
                .addOnSuccessListener(result -> {
                    if (result.hasResolution()) {
                        PendingIntent pendingIntent = result.getPendingIntent();
                        if (pendingIntent == null) {
                            failDriveAuthorization("Google no devolviÃƒÆ’Ã‚Â³ una autorizaciÃƒÆ’Ã‚Â³n vÃƒÆ’Ã‚Â¡lida");
                            return;
                        }
                        try {
                            startIntentSenderForResult(pendingIntent.getIntentSender(),
                                    DRIVE_AUTHORIZATION_REQUEST, null, 0, 0, 0);
                        } catch (IntentSender.SendIntentException error) {
                            failDriveAuthorization("No se pudo abrir la autorizaciÃƒÆ’Ã‚Â³n de Google");
                        }
                    } else {
                        deliverDriveAuthorization(result);
                    }
                })
                .addOnFailureListener(error ->
                        failDriveAuthorization("Google Play Services no pudo autorizar Drive"));
    }

    private void deliverDriveAuthorization(AuthorizationResult result) {
        String accessToken = result == null ? null : result.getAccessToken();
        if (accessToken == null || accessToken.trim().isEmpty()) {
            failDriveAuthorization("Google no devolviÃƒÆ’Ã‚Â³ un token de acceso");
            return;
        }
        GoogleSignInAccount googleAccount = result.toGoogleSignInAccount();
        driveAccount = googleAccount == null ? null : googleAccount.getAccount();
        driveAccessToken = accessToken;
        String payload = "{access_token:" + JSONObject.quote(accessToken) +
                ",token_type:'Bearer',scope:" + JSONObject.quote(DRIVE_SCOPE) +
                ",expires_in:3000}";
        runOnUiThread(() -> webView.evaluateJavascript(
                "window.vkNativeDriveAuthorizationResult&&" +
                        "window.vkNativeDriveAuthorizationResult(" + payload + ");", null));
    }

    private void beginDriveRevocation() {
        if (driveAccount == null) {
            revokeDriveTokenOverHttps();
            return;
        }
        RevokeAccessRequest request = RevokeAccessRequest.builder()
                .setAccount(driveAccount)
                .setScopes(Collections.singletonList(new Scope(DRIVE_SCOPE)))
                .build();
        Identity.getAuthorizationClient(this).revokeAccess(request)
                .addOnSuccessListener(ignored -> {
                    driveAccount = null;
                    driveAccessToken = null;
                    deliverDriveRevocation(true, null);
                })
                .addOnFailureListener(error -> revokeDriveTokenOverHttps());
    }

    private void revokeDriveTokenOverHttps() {
        final String token = driveAccessToken;
        if (token == null || token.trim().isEmpty()) {
            deliverDriveRevocation(false, "El token de Drive ya no estÃƒÆ’Ã‚Â¡ disponible en memoria");
            return;
        }
        new Thread(() -> {
            HttpURLConnection connection = null;
            try {
                byte[] body = ("token=" + URLEncoder.encode(token, "UTF-8"))
                        .getBytes(StandardCharsets.UTF_8);
                connection = (HttpURLConnection) new URL(
                        "https://oauth2.googleapis.com/revoke").openConnection();
                connection.setRequestMethod("POST");
                connection.setConnectTimeout(10000);
                connection.setReadTimeout(10000);
                connection.setDoOutput(true);
                connection.setRequestProperty("Content-Type", "application/x-www-form-urlencoded");
                connection.setFixedLengthStreamingMode(body.length);
                try (OutputStream output = connection.getOutputStream()) {
                    output.write(body);
                }
                int status = connection.getResponseCode();
                if (status == HttpURLConnection.HTTP_OK || status == HttpURLConnection.HTTP_BAD_REQUEST) {
                    driveAccount = null;
                    driveAccessToken = null;
                    deliverDriveRevocation(true, null);
                } else {
                    deliverDriveRevocation(false, "Google devolviÃƒÆ’Ã‚Â³ el estado " + status);
                }
            } catch (IOException error) {
                deliverDriveRevocation(false, "No se pudo contactar con Google para revocar el permiso");
            } finally {
                if (connection != null) connection.disconnect();
            }
        }, "VaultKey-Drive-Revoke").start();
    }

    private void deliverDriveRevocation(boolean ok, String error) {
        String payload = ok ? "{ok:true}" : "{ok:false,error:" + JSONObject.quote(error) + "}";
        runOnUiThread(() -> {
            if (webView != null) {
                webView.evaluateJavascript(
                        "window.vkNativeDriveDisconnectResult&&" +
                                "window.vkNativeDriveDisconnectResult(" + payload + ");", null);
            }
        });
    }

    private void failDriveAuthorization(String message) {
        String payload = "{error:" + JSONObject.quote(message) + "}";
        runOnUiThread(() -> {
            if (webView != null) {
                webView.evaluateJavascript(
                        "window.vkNativeDriveAuthorizationResult&&" +
                                "window.vkNativeDriveAuthorizationResult(" + payload + ");", null);
            }
            Toast.makeText(MainActivity.this, message, Toast.LENGTH_SHORT).show();
        });
    }

    @Override
    public void onBackPressed() {
        coverSensitiveContent();
        super.onBackPressed();
    }

    private int dp(int value) {
        return Math.round(value * getResources().getDisplayMetrics().density);
    }

    private final class PrototypeChromeClient extends WebChromeClient {
        @Override
        public boolean onShowFileChooser(WebView view, ValueCallback<Uri[]> callback,
                                         FileChooserParams params) {
            if (fileChooserCallback != null) fileChooserCallback.onReceiveValue(null);
            fileChooserCallback = callback;
            cameraOutputUri = null;

            boolean cameraRequested = false;
            String[] acceptTypes = params != null ? params.getAcceptTypes() : null;

            if (acceptTypes != null) {
                for (String type : acceptTypes) {
                    if (type != null && type.contains("application/x-vaultkey-camera")) {
                        cameraRequested = true;
                        break;
                    }
                }
            }

            if (cameraRequested) {
                try {
                    File scanDir = new File(getCacheDir(), "document_scans");

                    if (!scanDir.exists() && !scanDir.mkdirs()) {
                        throw new IOException("No se pudo crear document_scans");
                    }

                    File outputFile = File.createTempFile(
                            "vaultkey-scan-",
                            ".jpg",
                            scanDir
                    );

                    cameraOutputUri = VaultKeyFileProvider.getUriForFile(
                            MainActivity.this,
                            getPackageName() + ".fileprovider",
                            outputFile
                    );

                    Intent cameraIntent = new Intent(MediaStore.ACTION_IMAGE_CAPTURE);
                    cameraIntent.putExtra(MediaStore.EXTRA_OUTPUT, cameraOutputUri);
                    cameraIntent.addFlags(
                            Intent.FLAG_GRANT_READ_URI_PERMISSION
                                    | Intent.FLAG_GRANT_WRITE_URI_PERMISSION
                    );
                    cameraIntent.setClipData(
                            ClipData.newRawUri("VaultKey document scan", cameraOutputUri)
                    );

                    awaitingOwnActivityResult = true;
                    startActivityForResult(cameraIntent, FILE_CHOOSER_REQUEST);
                    return true;

                } catch (IOException | RuntimeException error) {
                    cameraOutputUri = null;
                    fileChooserCallback = null;
                    callback.onReceiveValue(null);

                    Toast.makeText(
                            MainActivity.this,
                            "No se pudo abrir la camara",
                            Toast.LENGTH_SHORT
                    ).show();

                    return false;
                }
            }

            Intent intent = new Intent(Intent.ACTION_OPEN_DOCUMENT);
            intent.addCategory(Intent.CATEGORY_OPENABLE);
            intent.setType("*/*");
            intent.putExtra(Intent.EXTRA_MIME_TYPES, new String[]{
                    "application/octet-stream",
                    "application/json",
                    "image/*"
            });
            intent.putExtra(Intent.EXTRA_ALLOW_MULTIPLE, false);

            try {
                awaitingOwnActivityResult = true;
                startActivityForResult(intent, FILE_CHOOSER_REQUEST);
                return true;

            } catch (RuntimeException error) {
                fileChooserCallback = null;
                callback.onReceiveValue(null);

                Toast.makeText(
                        MainActivity.this,
                        "No hay un selector de archivos disponible",
                        Toast.LENGTH_SHORT
                ).show();

                return false;
            }

        }
    }

    @SuppressWarnings("deprecation")
    private int getColorCompat(int colorId) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) return getColor(colorId);
        return getResources().getColor(colorId);
    }

    private final class LocalAssetClient extends WebViewClient {
        @Override
        public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest request) {
            Uri uri = request.getUrl();
            if (!"https".equals(uri.getScheme()) ||
                    !"appassets.androidplatform.net".equals(uri.getHost())) {
                return null;
            }
            return loadAsset(uri.getPath());
        }

        @Override
        public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
            Uri uri = request.getUrl();
            boolean nativeMainFrame = request.isForMainFrame() &&
                    "https".equals(uri.getScheme()) &&
                    "appassets.androidplatform.net".equals(uri.getHost());
            boolean nativeDriveConnect = request.isForMainFrame() &&
                    "https".equals(uri.getScheme()) &&
                    "appassets.androidplatform.net".equals(uri.getHost()) &&
                    NATIVE_DRIVE_CONNECT_PATH.equals(uri.getPath());
            if (nativeDriveConnect) {
                beginDriveAuthorization();
                return true;
            }
            if (nativeMainFrame && NATIVE_DRIVE_DISCONNECT_PATH.equals(uri.getPath())) {
                beginDriveRevocation();
                return true;
            }
            if (nativeMainFrame && NATIVE_AUTOFILL_SETTINGS_PATH.equals(uri.getPath())) {
                openSystemSettings(Settings.ACTION_REQUEST_SET_AUTOFILL_SERVICE);
                return true;
            }
            if (nativeMainFrame && NATIVE_SYSTEM_SETTINGS_PATH.equals(uri.getPath())) {
                openSystemSettings(Settings.ACTION_SETTINGS);
                return true;
            }
            boolean local = "https".equals(uri.getScheme()) &&
                    "appassets.androidplatform.net".equals(uri.getHost()) &&
                    uri.getPath() != null && uri.getPath().startsWith(ASSET_PREFIX);
            if (!local) {
                if (request.isForMainFrame() && "https".equals(uri.getScheme())) {
                    try {
                        startActivity(new Intent(Intent.ACTION_VIEW, uri));
                    } catch (RuntimeException error) {
                        Toast.makeText(MainActivity.this, R.string.blocked_navigation, Toast.LENGTH_SHORT).show();
                    }
                } else {
                    Toast.makeText(MainActivity.this, R.string.blocked_navigation, Toast.LENGTH_SHORT).show();
                }
            }
            return !local;
        }

        private void openSystemSettings(String action) {
            try {
                startActivity(new Intent(action));
            } catch (RuntimeException error) {
                Toast.makeText(MainActivity.this, R.string.blocked_navigation, Toast.LENGTH_SHORT).show();
            }
        }

        @Override
        public void onPageFinished(WebView view, String url) {
            if (url != null && url.startsWith(LOCAL_ORIGIN + ASSET_PREFIX)) markPageReady();
        }

        @Override
        public void onSafeBrowsingHit(WebView view, WebResourceRequest request,
                                      int threatType, SafeBrowsingResponse callback) {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O_MR1) callback.backToSafety(true);
        }

        private WebResourceResponse loadAsset(String path) {
            if (path == null || !path.startsWith(ASSET_PREFIX) || path.contains("..")) {
                return new WebResourceResponse("text/plain", "UTF-8", null);
            }
            String assetPath = "web/" + path.substring(ASSET_PREFIX.length());
            if (assetPath.endsWith("/")) assetPath += "index.html";
            try {
                InputStream input = getAssets().open(assetPath);
                String extension = MimeTypeMap.getFileExtensionFromUrl(assetPath);
                String mime = MimeTypeMap.getSingleton().getMimeTypeFromExtension(
                        extension == null ? "" : extension.toLowerCase(Locale.ROOT));
                if (mime == null) mime = "application/octet-stream";
                return new WebResourceResponse(mime, "UTF-8", input);
            } catch (IOException error) {
                return new WebResourceResponse("text/plain", "UTF-8", null);
            }
        }
    }
}







