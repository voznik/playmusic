/* Example usage script.
 *
 * Any copyright is dedicated to the Public Domain.
 * http://creativecommons.org/publicdomain/zero/1.0/ 
 */

var PlayMusic = require('./play');

var pm = new PlayMusic();
pm.init(function() {
    pm.getLibrary(function(library) {
        var song = library.data.items.pop();
        console.log(song);
        pm.getStreamUrl(song.id, function(streamUrl) {
            console.log(streamUrl);
        });
    });
});
