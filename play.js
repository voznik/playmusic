/* Node-JS Google Play Music API
 *
 * Based on the work of the Google Play Music resolver for Tomahawk
 * and the gmusicapi project by Simon Weber.
 */

var https = require('https');
var querystring = require('querystring');
var url = require('url');
var CryptoJS = require("crypto-js");


var util = {};
util.request = function(reqUrl, options, data, success, error) {
    var opt = url.parse(reqUrl);
    console.log("\nreqUrl\t", reqUrl, "\noptions\t", options, "\ndata\t", data);
    Object.keys(options).forEach(function(k) {
        opt[k] = options[k];
    });
    console.log("opt", opt);
    var req = https.request(opt, function(res) {
        console.log("result!", res.statusCode, res.headers);
        res.setEncoding('utf8');
        var body = "";
        res.on('data', function(chunk) {
            body += chunk;
        });
        res.on('end', function() {
            if(res.statusCode === 200) {
                success(body, res);
            } else {
                error(body, null, res);
            }
        });
        res.on('error', function() {
            error(null, Array.prototype.slice.apply(arguments), res);
        });
    });
    if(typeof data !== "undefined" && data !== null) req.write(data);
    req.end();
};

util.parseKeyValues = function(body) {
    var obj = {};
    body.split("\n").forEach(function(line) {
        var pos = line.indexOf("=");
        if(pos > 0) obj[line.substr(0, pos)] = line.substr(pos+1);
    });
    return obj;
};

var PlayMusic = function() {};

PlayMusic.prototype._baseURL = 'https://www.googleapis.com/sj/v1/';
PlayMusic.prototype._webURL = 'https://play.google.com/music/';
PlayMusic.prototype.cacheTime = 300;

PlayMusic.prototype.init = function(callback) {
    var that = this;
    this._email = "";  // @TODO load this from something
    this._password = ""; // @TODO load this from something

    // load signing key
    var s1 = CryptoJS.enc.Base64.parse('VzeC4H4h+T2f0VI180nVX8x+Mb5HiTtGnKgH52Otj8ZCGDz9jRWyHb6QXK0JskSiOgzQfwTY5xgLLSdUSreaLVMsVVWfxfa8Rw==');
    var s2 = CryptoJS.enc.Base64.parse('ZAPnhUkYwQ6y5DdQxWThbvhJHN8msQ1rqJw0ggKdufQjelrKuiGGJI30aswkgCWTDyHkTGK9ynlqTkJ5L4CiGGUabGeo8M6JTQ==');

    for (var idx = 0; idx < s1.words.length; idx++) {
        s1.words[ idx ] ^= s2.words[ idx ];
    }

    this._key = s1;

    this._login(function() {
        that._loadWebToken(function() {
            that._loadSettings(function() {
                that._getData(function (response) {
                    that.trackCount = response.data.items.length;
                    callback();
                });
                that._ready = true;
            });
        });
    });
};

PlayMusic.prototype._getData = function(callback) {
    if (this.hasOwnProperty('cachedRequest') && this.cachedRequest.time + this.cacheTime > Date.now()) {
        callback(this.cachedRequest.response);
    } else {
        var that = this;
        util.request(
            this._baseURL + "trackfeed",
            { method: "POST", headers: {"Content-type": "application/x-www-form-urlencoded", "Authorization": "GoogleLogin auth=" + this._token } },
            null,
            function(data, res) {
                that.cachedRequest = {
                    response: JSON.parse(data),
                    time: Date.now()
                };
                console.log(data);
                callback(that.cachedRequest.response);
            },
            function(data, err, res) {
                console.log("error in _getData", data, res.statusCode, err);
            }
        );
    }
};
// @TODO fix this
PlayMusic.prototype._execSearch = function(query, callback, max_results) {
    var that = this;
    this._getData(function (response) {
        var results = { tracks: [], albums: [], artists: [] };
        for (var idx = 0; idx < response.data.items.length; idx++) {
            var entry = response.data.items[ idx ];
            var lowerQuery = query.toLowerCase();
            if (entry.artist.toLowerCase() === lowerQuery || entry.album.toLowerCase() === lowerQuery || entry.title.toLowerCase() === lowerQuery) {
                var artist = that._convertArtist(entry);
                var album = that._convertAlbum(entry);
                if (!that.containsObject(artist, results.artists)) {
                    results.artists.push(artist);
                }
                if (!that.containsObject(album, results.albums)) {
                    results.albums.push(album);
                }
                results.tracks.push(that._convertTrack(entry));
            }
        }
        callback.call( window, results );
    });

};

PlayMusic.prototype.getStreamUrl = function (id) {
    // TODO - this is required for the All Access part of Google Music
    // generate 13-digit numeric salt
    var salt = '' + Math.floor( Math.random() * 10000000000000 );

    // generate SHA1 HMAC of track ID + salt
    // encoded with URL-safe base64
    var sig = CryptoJS.HmacSHA1( id + salt, this._key )
            .toString( CryptoJS.enc.Base64 )
            .replace( /\=+$/, '' )   // no padding
            .replace( /\+/g, '-' )  // URL-safe alphabet
            .replace( /\//g, '_' )  // URL-safe alphabet
        ;

    var qp = {
        u: "0",
        net: "wifi",
        pt: "e",
        targetkbps: "8310",
        slt: salt,
        sig: sig
    };
    if(id.charAt(0) === "T") {
        qp.mjck = id;
    } else {
        qp.songid = id;
    }

    var qstring = querystring.stringify(qp);
    util.request(
        'https://android.clients.google.com/music/mplay?' + qstring, 
        {method: "GET", headers: { "Content-type": "application/x-www-form-urlencoded", "Authorization": "GoogleLogin auth=" + this._token, "X-Device-ID": this._deviceId} },
        null,
        function(data, res) {
            console.log(data);
        },
        function(data, err, res) {
            console.log("error getting stream urls", res.statusCode, data, err);
        }
    );
};

PlayMusic.prototype._loadSettings = function (callback) {
    var that = this;

    util.request(
        this._webURL + "services/loadsettings?u=0&xt=" + encodeURIComponent(this._xt),
        { method: "POST", headers: {  "Authorization": "GoogleLogin auth=" + this._token, "Content-Type": "application/json" } },
        JSON.stringify({"sessionId": ""}),
        function(body, res) {
            var response = JSON.parse(body);
            console.log("response", response);
            that._allAccess = response.settings.isSubscription;
            console.log("Google Play Music All Access is ", (that._allAccess ? "enabled" : "disabled" ));

            var device = null;
            var devices = response.settings.devices;
            for (var i = 0; i < devices.length; i++) {
                var entry = devices[i];
                if ('PHONE' == entry.type) {
                    device = entry;
                    break;
                }
            }

            if(device) {
                that._deviceId = device.id.slice(2);
                console.log("DEVICE ID", that._deviceId);

                console.log("using device ID from " + device.carrier + " " + device.manufacturer + " " + device.model);

                callback();
            } else {
                console.log("unable to find a device on your account");
            }
        },
        function(body, err, res) {
            console.log("error loading settings", res.statusCode, body, err);
        }
    );
};

PlayMusic.prototype._loadWebToken = function (callback) {
    var that = this;
    util.request(
        this._webURL + "listen",
        { method: "HEAD", headers: { "Authorization": "GoogleLogin auth=" + this._token } },
        null,
        function(data, res) {
            console.log("res.headers", res.headers);
            that._cookies = res.headers['set-cookie'];
            var cookies = {};
            res.headers['set-cookie'].forEach(function(c) {
                var pos = c.indexOf("=");
                if(pos > 0) cookies[c.substr(0, pos)] = c.substr(pos+1, c.indexOf(";")-(pos+1));
            });
            if (typeof cookies.xt !== "undefined") {
                that._xt = cookies.xt;
                callback();
            } else {
                console.log("xt cookie missing");
                return;
            }
        },
        function(data, err, res) {
            console.log("request for xt cookie failed:" + res.statusCode, data, err);
        }
    );
};

/** Called when the login process is completed.
 * @callback loginCB
 */

/** Asynchronously authenticates with the SkyJam service.
 * Only one login attempt will run at a time. If a login request is
 * already pending the callback (if one is provided) will be queued
 * to run when it is complete.
 *
 * @param {loginCB} [callback] a function to be called on completion
 */
PlayMusic.prototype._login =  function (callback) {
    var that = this;
    this._token = null;

    // if a login is already in progress just queue the callback
    if (this._loginLock) {
        this._loginCallbacks.push( callback );
        return;
    }

    this._loginLock = true;
    this._loginCallbacks = [ callback ];


    var data = {
        accountType: "HOSTED_OR_GOOGLE",
        Email: that._email.trim(),
        Passwd: that._password.trim(),
        service: "sj",
        source: "node-gmusic"
    };
    util.request("https://www.google.com/accounts/ClientLogin",
        { method: "POST", headers: { "Content-type": "application/x-www-form-urlencoded" }},
        querystring.stringify(data),
        function(data, res) {
            var obj = util.parseKeyValues(data);
            console.log("login success!", obj);
            that._token = obj.Auth;
            that._loginLock = false;
            for (var idx = 0; idx < that._loginCallbacks.length; idx++) {
                that._loginCallbacks[idx]();
            }
            that._loginCallbacks = null;
        },
        function(data, err, res) {
            console.log("login failed!", res.statusCode, data, err);
        }
    );
};


var pm = new PlayMusic();
pm.init(function() {
    console.log("============================================================");
//    pm.getStreamUrl("84df1e4e-6b76-3147-9a78-a44becc28dc5");
    //pm.getStreamUrl("6f7120c8-4454-316e-a3ea-df042887fe00");
    //pm.getStreamUrl("d895bf67-c3d8-3b4a-b7e8-cc5df5c4e0b2");
    pm.getStreamUrl("7f405ca5-4b9b-378a-a0db-72764a215cda");
});
