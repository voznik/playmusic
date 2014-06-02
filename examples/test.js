/* Example usage script.
 *
 * Any copyright is dedicated to the Public Domain.
 * http://creativecommons.org/publicdomain/zero/1.0/ 
 */

var fs = require('fs');
var PlayMusic = require('playmusic');

var pm = new PlayMusic();
var config = JSON.parse(fs.readFileSync("config.json"));
pm.init(config, function() {
    pm.getLibrary(function(library) {
        var song = library.data.items.pop();
        console.log(song);
        pm.getStreamUrl(song.id, function(streamUrl) {
            console.log(streamUrl);
        });
    });
});
