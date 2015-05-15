/* Example usage script.
 *
 * Any copyright is dedicated to the Public Domain.
 * http://creativecommons.org/publicdomain/zero/1.0/
 */

var fs = require('fs');
var PlayMusic = require('../');

var pm = new PlayMusic();
var config = JSON.parse(fs.readFileSync("config.json"));
pm.init(config, function() {
    // pm.getLibrary(function(err, library) {
    //     if(err) console.error(err);
    //     var song = library.data.items.pop();
    //     console.log(song);
    //     pm.getStreamUrl(song.id, function(err, streamUrl) {
    //         if(err) console.error(err);
    //         console.log(streamUrl);
    //     });
    // });

    // pm.search("bastille lost fire", 5, function(err, data) {
    //     if(err) console.error(err);
    //
    //     var song = data.entries.sort(function(a, b) {
    //         return a.score < b.score;
    //     }).shift();
    //     console.log(song);
    //     pm.getStreamUrl(song.track.nid, function(err, streamUrl) {
    //         if(err) console.error(err);
    //         console.log(streamUrl);
    //     });
    // });

    //
    // pm.getPlayLists(function(err, data) {
    //     console.log(data.data.items);
    // });
    //
    // pm.getPlayListEntries(function(err, data) {
    //     console.log(data.data.items);
    // });

    // pm.getStreamUrl("Thvfmp2be3c7kbp6ny4arxckz54", console.log);
});
