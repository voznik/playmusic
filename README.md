Node-JS Google Play Music API
====

Written by Jamon Terrell <git@jamonterrell.com>

How to Use
----

Initialization
```
var PlayMusic = require('../');

var pm = new PlayMusic();

pm.init({email: "email@address.com", password: "password"}, function() {
  // place code here
})
```

Retrieve List of Songs in your Library, retrieve the stream URL
```
    pm.getLibrary(function(library) {
        var song = library.data.items.pop();
        console.log(song);
        pm.getStreamUrl(song.id, function(streamUrl) {
            console.log(streamUrl);
        });
    });
```

Search for a song
```
    pm.search("bastille lost fire", 5, function(data) {
        var song = data.entries.sort(function(a, b) {
            return a.score < b.score;
        }).shift();
        console.log(song);
        pm.getStreamUrl(song.track.nid, function(streamUrl) {
            console.log(streamUrl);
        });
    }, function(err) {
        console.log(err);
    });
```

Retrieve Playlists
```
    pm.getPlayLists(function(data) {
        console.log(data.data.items);
    });

    pm.getPlayListEntries(function(data) {
        console.log(data.data.items);
    });
```

Retrieve the Stream URL for a song by id
```
    pm.getStreamUrl("Thvfmp2be3c7kbp6ny4arxckz54", console.log);
```

Future
----
* Externalize all node.js specific code, add base classes for re-usable functionality
  * Implement browser version?
* Add features
  * complete API
* Rewrite all responses from services to be more consistent, useful?
* Suggestions?  submit an issue!


License
----
This Source Code Form is subject to the terms of the Mozilla Public
License, v. 2.0. If a copy of the MPL was not distributed with this
file, You can obtain one at http://mozilla.org/MPL/2.0/.

Attribution
----
Based partially on the work of the Google Play Music resolver for Tomahawk (https://github.com/tomahawk-player/tomahawk-resolvers/blob/master/gmusic/content/contents/code/gmusic.js)
and the gmusicapi project by Simon Weber (https://github.com/simon-weber/Unofficial-Google-Music-API/blob/develop/gmusicapi/protocol/mobileclient.py).

