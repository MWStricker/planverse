# Pre-Deployment QA Checklist

## ✅ Notification Navigation
- [ ] Click on new message notification → Opens correct conversation
- [ ] Click on post like notification → Scrolls to correct post
- [ ] Click on post comment notification → Scrolls to correct post
- [ ] Click on friend request notification → Opens People tab
- [ ] Notification marked as read after click
- [ ] Dialog closes after navigation
- [ ] Works with notification for deleted post (shows empty feed gracefully)
- [ ] Works with notification for deleted message (shows empty conversation)
- [ ] Hash clears after navigation
- [ ] Back button doesn't re-trigger navigation

## ✅ Post Maximization
- [ ] Click on post card → Opens maximized view
- [ ] Click on like button → Doesn't open maximize (only likes)
- [ ] Click on comment button → Opens comments dialog (not maximize)
- [ ] Click on avatar → Opens profile (not maximize)
- [ ] Click on image → Opens image zoom (not maximize)
- [ ] Hover shows shadow effect on post cards
- [ ] Like button works in maximized view
- [ ] Like count updates optimistically
- [ ] "View All Comments" button works
- [ ] Clicking avatar in maximized view opens profile
- [ ] Clicking image in maximized view opens image zoom
- [ ] Dialog scrolls properly on small screens
- [ ] Works on mobile (touch events)
- [ ] Works on tablet
- [ ] Works on desktop
- [ ] ESC key closes dialog
- [ ] Click outside closes dialog

## ✅ Real-time Features
- [ ] User presence updates in real-time (test with 2 browsers)
- [ ] Messages arrive in real-time
- [ ] Post likes update in real-time
- [ ] Notifications appear in real-time
- [ ] Friend requests appear in real-time
- [ ] Heartbeat maintains online status
- [ ] Going offline sets status correctly
- [ ] Coming back online restores status
- [ ] Multiple tabs handle presence correctly
- [ ] Network reconnection works (simulate by throttling)
- [ ] Connection survives browser idle (15+ minutes)

## ✅ Performance
- [ ] App loads in < 3 seconds on 3G
- [ ] Feed scrolling is smooth (60fps)
- [ ] Image loading doesn't block UI
- [ ] No console errors in production build
- [ ] Real-time updates don't cause lag
- [ ] Memory usage stays stable over 30 minutes

## ✅ Edge Cases
- [ ] Works with empty feed
- [ ] Works with 100+ posts in feed
- [ ] Handles rapid notification clicks
- [ ] Handles rapid post likes
- [ ] Handles deleted content gracefully
- [ ] Works with slow network (throttle to 3G)
- [ ] Works offline (shows appropriate errors)
- [ ] Works with ad blockers enabled
- [ ] Works in incognito mode
- [ ] Session persists across page refreshes

## ✅ Error Boundaries
- [ ] Error boundary catches React errors
- [ ] Error boundary shows fallback UI
- [ ] Error boundary allows retry
- [ ] Error boundary logs errors to console
- [ ] Error boundary doesn't crash entire app

## ✅ Connection Status
- [ ] Connection status shows when offline
- [ ] Connection status shows when degraded
- [ ] Connection status auto-hides when online
- [ ] Connection status visible on all pages
- [ ] Connection status doesn't block UI

## ✅ Reconnection Logic
- [ ] App reconnects after network drop
- [ ] App shows retry attempts in console
- [ ] App uses exponential backoff
- [ ] App gives up after max attempts
- [ ] App shows toast on reconnection failure
