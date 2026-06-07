package com.focusflow.app;

import android.os.Bundle;
import android.webkit.WebView;
import android.webkit.WebSettings;
import android.webkit.WebResourceResponse;
import android.content.Context;
import android.content.SharedPreferences;
import java.io.File;
import java.net.URL;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    private static final String PREFS_NAME = "focusflow_prefs";
    private static final String KEY_LAST_VERSION = "last_version_code";
    private static final int CURRENT_VERSION = 2;

    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(CalendarPlugin.class);
        clearCacheOnUpdate();
        super.onCreate(savedInstanceState);
        disableWebViewCache();
    }

    @Override
    public void onResume() {
        super.onResume();
        clearWebViewCache();
    }

    private void clearCacheOnUpdate() {
        try {
            SharedPreferences prefs = getSharedPreferences(PREFS_NAME, MODE_PRIVATE);
            int lastVersion = prefs.getInt(KEY_LAST_VERSION, 0);
            if (lastVersion < CURRENT_VERSION) {
                deleteCacheDir(this);
                prefs.edit().putInt(KEY_LAST_VERSION, CURRENT_VERSION).apply();
            }
        } catch (Exception e) {
            e.printStackTrace();
        }
    }

    private void disableWebViewCache() {
        try {
            WebView webView = getBridge().getWebView();
            if (webView != null) {
                WebSettings settings = webView.getSettings();
                settings.setCacheMode(WebSettings.LOAD_NO_CACHE);
                settings.setDomStorageEnabled(true);
                settings.setDatabaseEnabled(true);
                webView.clearCache(true);
                webView.clearHistory();
                webView.clearFormData();
            }
        } catch (Exception e) {
            e.printStackTrace();
        }
        deleteCacheDir(this);
    }

    private void clearWebViewCache() {
        try {
            WebView webView = getBridge().getWebView();
            if (webView != null) {
                webView.clearCache(true);
                webView.clearHistory();
                webView.clearFormData();
                WebSettings settings = webView.getSettings();
                settings.setCacheMode(WebSettings.LOAD_NO_CACHE);
            }
        } catch (Exception e) {
            e.printStackTrace();
        }
    }

    public static void deleteCacheDir(Context context) {
        try {
            File cacheDir = context.getCacheDir();
            if (cacheDir != null && cacheDir.isDirectory()) {
                deleteDir(cacheDir);
            }
            File webviewCache = new File(context.getApplicationInfo().dataDir, "app_webview");
            if (webviewCache != null && webviewCache.isDirectory()) {
                deleteDir(webviewCache);
            }
            File webviewDir = new File(context.getApplicationInfo().dataDir, "app_webview");
            if (webviewDir != null && webviewDir.isDirectory()) {
                File[] subDirs = webviewDir.listFiles();
                if (subDirs != null) {
                    for (File subDir : subDirs) {
                        if (subDir.getName().contains("Cache") || subDir.getName().contains("cache")) {
                            deleteDir(subDir);
                        }
                    }
                }
            }
        } catch (Exception e) {
            e.printStackTrace();
        }
    }

    public static boolean deleteDir(File dir) {
        if (dir != null && dir.isDirectory()) {
            String[] children = dir.list();
            if (children != null) {
                for (String child : children) {
                    boolean success = deleteDir(new File(dir, child));
                    if (!success) {
                        return false;
                    }
                }
            }
            return dir.delete();
        } else if (dir != null && dir.isFile()) {
            return dir.delete();
        }
        return false;
    }
}
