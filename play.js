/* Node-JS Google Play Music API
 *
 * Based on the work of the Google Play Music resolver for Tomahawk
 * and the gmusicapi project by Simon Weber.
 */
var fs = require('fs');
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
util.Base64 = {
    _map: "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_",
    stringify: CryptoJS.enc.Base64.stringify,
    parse: CryptoJS.enc.Base64.parse
};
util.salt = function(len) {
    return Array.apply(0, Array(len)).map(function() {
        return (function(charset){
            return charset.charAt(Math.floor(Math.random() * charset.length));
        }('abcdefghijklmnopqrstuvwxyz0123456789'));
    }).join('');
};


var PlayMusic = function() {};

PlayMusic.prototype._baseURL = 'https://www.googleapis.com/sj/v1/';
PlayMusic.prototype._webURL = 'https://play.google.com/music/';
PlayMusic.prototype._mobileURL = 'https://android.clients.google.com/music/';
PlayMusic.prototype._accountURL = 'https://www.google.com/accounts/';
PlayMusic.prototype.cacheTime = 300;


PlayMusic.prototype.request = function(reqUrl, options, data, success, error) {
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


PlayMusic.prototype.init = function(callback) {
    var that = this;
    var config = JSON.parse(fs.readFileSync("config.json"));

    this._email = config.email;
    this._password = config.password;

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
                //that._getData(function (response) {
                    callback();
                //});
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
                callback(that.cachedRequest.response);
            },
            function(data, err, res) {
                console.log("error in _getData", data, res.statusCode, err);
            }
        );
    }
};

PlayMusic.prototype.getStreamUrl = function (id, callback) {
    var salt = util.salt(13);
    var sig = CryptoJS.HmacSHA1(id + salt, this._key).toString(util.Base64);
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
        this._mobileURL + 'mplay?' + qstring, 
        {method: "GET", headers: { "Content-type": "application/x-www-form-urlencoded", "Authorization": "GoogleLogin auth=" + this._token, "X-Device-ID": this._deviceId} },
        null,
        function(data, res) {
            console.log(data);
        },
        function(data, err, res) {
            if(res.statusCode === 302) {
                callback(res.headers.location);
            } else {
                console.log("error getting stream urls", res.statusCode, data, err);
            }
        }
    );
};

PlayMusic.prototype._loadSettings = function (callback) {
    var that = this;

    util.request(
        this._webURL + "services/loadsettings?" + querystring.stringify({u: 0, xt: this._xt}),
        { method: "POST", headers: {  "Authorization": "GoogleLogin auth=" + this._token, "Content-Type": "application/json" } },
        JSON.stringify({"sessionId": ""}),
        function(body, res) {
            var response = JSON.parse(body);
            that._allAccess = response.settings.isSubscription;
            console.log("Google Play Music All Access is ", (that._allAccess ? "enabled" : "disabled" ));

            var devices = response.settings.devices.filter(function(d) {
                return d.type === "PHONE";
            });
            if(devices.length > 0) {
                that._deviceId = devices[0].id.slice(2);
                console.log("DEVICE ID", that._deviceId);
                console.log("using device ID from " + devices[0].carrier + " " + devices[0].manufacturer + " " + devices[0].model);

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

    var data = {
        accountType: "HOSTED_OR_GOOGLE",
        Email: that._email.trim(),
        Passwd: that._password.trim(),
        service: "sj",
        source: "node-gmusic"
    };
    util.request(this._accountURL + "ClientLogin",
        { method: "POST", headers: { "Content-type": "application/x-www-form-urlencoded" }},
        querystring.stringify(data),
        function(data, res) {
            var obj = util.parseKeyValues(data);
            console.log("login success!", obj);
            that._token = obj.Auth;
            callback();
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
    pm.getStreamUrl("0dfc52a6-a9e1-3471-845c-f99eaa832ce2", console.log);
});
