package com.focusflow.app;

import android.Manifest;
import android.content.ContentResolver;
import android.content.ContentValues;
import android.content.pm.PackageManager;
import android.database.Cursor;
import android.net.Uri;
import android.provider.CalendarContract;
import android.util.Log;

import androidx.core.app.ActivityCompat;
import androidx.core.content.ContextCompat;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;

import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

import java.util.Calendar;
import java.util.TimeZone;

@CapacitorPlugin(
    name = "CalendarBridge",
    permissions = {
        @Permission(
            strings = {
                Manifest.permission.READ_CALENDAR,
                Manifest.permission.WRITE_CALENDAR
            },
            alias = "calendar"
        )
    }
)
public class CalendarPlugin extends Plugin {

    private static final String TAG = "CalendarPlugin";

    @PluginMethod
    public void checkPermission(PluginCall call) {
        boolean hasRead = ContextCompat.checkSelfPermission(getContext(), Manifest.permission.READ_CALENDAR)
                == PackageManager.PERMISSION_GRANTED;
        boolean hasWrite = ContextCompat.checkSelfPermission(getContext(), Manifest.permission.WRITE_CALENDAR)
                == PackageManager.PERMISSION_GRANTED;

        JSObject ret = new JSObject();
        ret.put("granted", hasRead && hasWrite);
        ret.put("read", hasRead);
        ret.put("write", hasWrite);
        call.resolve(ret);
    }

    @PluginMethod
    public void requestPermission(PluginCall call) {
        if (getPermissionState("calendar") == com.getcapacitor.PermissionState.GRANTED) {
            JSObject ret = new JSObject();
            ret.put("granted", true);
            call.resolve(ret);
        } else {
            requestPermissionForAlias("calendar", call, "calendarPermissionCallback");
        }
    }

    @PermissionCallback
    private void calendarPermissionCallback(PluginCall call) {
        if (getPermissionState("calendar") == com.getcapacitor.PermissionState.GRANTED) {
            JSObject ret = new JSObject();
            ret.put("granted", true);
            call.resolve(ret);
        } else {
            JSObject ret = new JSObject();
            ret.put("granted", false);
            call.resolve(ret);
        }
    }

    @PluginMethod
    public void getCalendars(PluginCall call) {
        if (!hasCalendarPermission(call)) return;

        ContentResolver cr = getContext().getContentResolver();
        Uri uri = CalendarContract.Calendars.CONTENT_URI;
        String[] projection = new String[]{
                CalendarContract.Calendars._ID,
                CalendarContract.Calendars.CALENDAR_DISPLAY_NAME,
                CalendarContract.Calendars.ACCOUNT_NAME,
                CalendarContract.Calendars.OWNER_ACCOUNT
        };

        Cursor cursor = cr.query(uri, projection, null, null, null);
        JSONArray calendars = new JSONArray();

        if (cursor != null) {
            while (cursor.moveToNext()) {
                JSONObject cal = new JSONObject();
                try {
                    cal.put("id", cursor.getLong(0));
                    cal.put("name", cursor.getString(1));
                    cal.put("account", cursor.getString(2));
                    cal.put("owner", cursor.getString(3));
                    calendars.put(cal);
                } catch (JSONException e) {
                    Log.e(TAG, "JSON error", e);
                }
            }
            cursor.close();
        }

        JSObject ret = new JSObject();
        ret.put("calendars", calendars);
        call.resolve(ret);
    }

    @PluginMethod
    public void getEvents(PluginCall call) {
        if (!hasCalendarPermission(call)) return;

        long calendarId = call.getLong("calendarId", -1L);
        long startTime = call.getLong("startTime", 0L);
        long endTime = call.getLong("endTime", 0L);

        if (calendarId == -1L || startTime == 0L || endTime == 0L) {
            call.reject("Missing required parameters: calendarId, startTime, endTime");
            return;
        }

        ContentResolver cr = getContext().getContentResolver();
        Uri uri = CalendarContract.Events.CONTENT_URI;
        String[] projection = new String[]{
                CalendarContract.Events._ID,
                CalendarContract.Events.TITLE,
                CalendarContract.Events.DESCRIPTION,
                CalendarContract.Events.DTSTART,
                CalendarContract.Events.DTEND,
                CalendarContract.Events.EVENT_LOCATION,
                CalendarContract.Events.CALENDAR_ID
        };

        String selection = CalendarContract.Events.CALENDAR_ID + " = ? AND " +
                CalendarContract.Events.DTSTART + " >= ? AND " +
                CalendarContract.Events.DTSTART + " <= ?";
        String[] selectionArgs = new String[]{String.valueOf(calendarId), String.valueOf(startTime), String.valueOf(endTime)};

        Cursor cursor = cr.query(uri, projection, selection, selectionArgs,
                CalendarContract.Events.DTSTART + " ASC");
        JSONArray events = new JSONArray();

        if (cursor != null) {
            while (cursor.moveToNext()) {
                JSONObject event = new JSONObject();
                try {
                    event.put("id", cursor.getLong(0));
                    event.put("title", cursor.getString(1));
                    event.put("description", cursor.getString(2));
                    event.put("startTime", cursor.getLong(3));
                    event.put("endTime", cursor.getLong(4));
                    event.put("location", cursor.getString(5));
                    event.put("calendarId", cursor.getLong(6));
                    events.put(event);
                } catch (JSONException e) {
                    Log.e(TAG, "JSON error", e);
                }
            }
            cursor.close();
        }

        JSObject ret = new JSObject();
        ret.put("events", events);
        call.resolve(ret);
    }

    @PluginMethod
    public void addEvent(PluginCall call) {
        if (!hasCalendarPermission(call)) return;

        long calendarId = call.getLong("calendarId", -1L);
        String title = call.getString("title", "");
        String description = call.getString("description", "");
        long startTime = call.getLong("startTime", 0L);
        long endTime = call.getLong("endTime", 0L);
        String location = call.getString("location", "");

        if (calendarId == -1L || title.isEmpty() || startTime == 0L || endTime == 0L) {
            call.reject("Missing required parameters");
            return;
        }

        ContentResolver cr = getContext().getContentResolver();
        ContentValues values = new ContentValues();
        values.put(CalendarContract.Events.DTSTART, startTime);
        values.put(CalendarContract.Events.DTEND, endTime);
        values.put(CalendarContract.Events.TITLE, title);
        values.put(CalendarContract.Events.DESCRIPTION, description);
        values.put(CalendarContract.Events.CALENDAR_ID, calendarId);
        values.put(CalendarContract.Events.EVENT_TIMEZONE, TimeZone.getDefault().getID());
        if (!location.isEmpty()) {
            values.put(CalendarContract.Events.EVENT_LOCATION, location);
        }

        Uri uri = cr.insert(CalendarContract.Events.CONTENT_URI, values);
        long eventId = Long.parseLong(uri.getLastPathSegment());

        JSObject ret = new JSObject();
        ret.put("eventId", eventId);
        ret.put("success", true);
        call.resolve(ret);
    }

    @PluginMethod
    public void deleteEvent(PluginCall call) {
        if (!hasCalendarPermission(call)) return;

        long eventId = call.getLong("eventId", -1L);
        if (eventId == -1L) {
            call.reject("Missing eventId");
            return;
        }

        ContentResolver cr = getContext().getContentResolver();
        Uri uri = Uri.withAppendedPath(CalendarContract.Events.CONTENT_URI, String.valueOf(eventId));
        int rows = cr.delete(uri, null, null);

        JSObject ret = new JSObject();
        ret.put("success", rows > 0);
        call.resolve(ret);
    }

    @PluginMethod
    public void updateEvent(PluginCall call) {
        if (!hasCalendarPermission(call)) return;

        long eventId = call.getLong("eventId", -1L);
        if (eventId == -1L) {
            call.reject("Missing eventId");
            return;
        }

        ContentResolver cr = getContext().getContentResolver();
        Uri uri = Uri.withAppendedPath(CalendarContract.Events.CONTENT_URI, String.valueOf(eventId));
        ContentValues values = new ContentValues();

        if (call.hasOption("title")) values.put(CalendarContract.Events.TITLE, call.getString("title"));
        if (call.hasOption("description")) values.put(CalendarContract.Events.DESCRIPTION, call.getString("description"));
        if (call.hasOption("startTime")) values.put(CalendarContract.Events.DTSTART, call.getLong("startTime"));
        if (call.hasOption("endTime")) values.put(CalendarContract.Events.DTEND, call.getLong("endTime"));
        if (call.hasOption("location")) values.put(CalendarContract.Events.EVENT_LOCATION, call.getString("location"));

        int rows = cr.update(uri, values, null, null);

        JSObject ret = new JSObject();
        ret.put("success", rows > 0);
        call.resolve(ret);
    }

    private boolean hasCalendarPermission(PluginCall call) {
        if (ContextCompat.checkSelfPermission(getContext(), Manifest.permission.READ_CALENDAR)
                != PackageManager.PERMISSION_GRANTED ||
            ContextCompat.checkSelfPermission(getContext(), Manifest.permission.WRITE_CALENDAR)
                != PackageManager.PERMISSION_GRANTED) {
            call.reject("Calendar permission not granted");
            return false;
        }
        return true;
    }
}
