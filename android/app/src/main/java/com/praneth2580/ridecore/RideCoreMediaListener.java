package com.praneth2580.ridecore;

import android.service.notification.NotificationListenerService;

/**
 * Does nothing itself. Android lets an app see the phone's media sessions (what Spotify or
 * YouTube Music is playing) only while one of its notification listeners has access, which
 * the rider grants once: RIDECORE's Music screen asks for it. See RideCoreMedia.
 */
public class RideCoreMediaListener extends NotificationListenerService {}
