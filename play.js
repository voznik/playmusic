/* Node-JS Google Play Music API
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 *
 * Based partially on the work of the Google Play Music resolver for Tomahawk (https://github.com/tomahawk-player/tomahawk-resolvers/blob/master/gmusic/content/contents/code/gmusic.js)
 * and the gmusicapi project by Simon Weber (https://github.com/simon-weber/Unofficial-Google-Music-API/blob/develop/gmusicapi/protocol/mobileclient.py).
 */
var fs = require('fs');
var https = require('https');
var querystring = require('querystring');
var url = require('url');
var CryptoJS = require("crypto-js");


var util = {};
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


PlayMusic.prototype.request = function(options) {
    //console.log("request", options);

    var opt = url.parse(options.url);
    opt.headers = {};
    opt.method = options.method || "GET";
    if(typeof options.options === "object") {
        Object.keys(options.options).forEach(function(k) {
            opt[k] = options.options[k];
        });
    }
    if(typeof this._token !== "undefined") opt.headers.Authorization = "GoogleLogin auth=" + this._token;
    opt.headers["Content-type"] = options.contentType || "application/x-www-form-urlencoded";

    //console.log("opt", opt);
    var req = https.request(opt, function(res) {
        //console.log("result!", res.statusCode, res.headers);
        res.setEncoding('utf8');
        var body = "";
        res.on('data', function(chunk) {
            body += chunk;
        });
        res.on('end', function() {
            if(res.statusCode === 200) {
                options.success(body, res);
            } else {
                options.error(body, null, res);
            }
        });
        res.on('error', function() {
            options.error(null, Array.prototype.slice.apply(arguments), res);
        });
    });
    if(typeof options.data !== "undefined") req.write(options.data);
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

    this._login(function(response) {
        that._token = response.Auth;
        that._getXt(function(xt) {
            that._xt = xt;
            that.getSettings(function(deviceId) {
                that._deviceId = deviceId;
                callback();
            });
        });
    });
};

PlayMusic.prototype._login =  function (success, error) {
    var that = this;
    var data = {
        accountType: "HOSTED_OR_GOOGLE",
        Email: that._email.trim(),
        Passwd: that._password.trim(),
        service: "sj",
        source: "node-gmusic"
    };
    this.request({
        method: "POST",
        url: this._accountURL + "ClientLogin",
        contentType: "application/x-www-form-urlencoded",
        data: querystring.stringify(data), // @TODO make this.request auto serialize based on contentType
        success: function(data, res) {
            var obj = util.parseKeyValues(data);
            success(obj);
        },
        error: function(data, err, res) {
            console.log("login failed!", res.statusCode, data, err);
        }
    });
};

PlayMusic.prototype._getXt = function (success, error) {
    var that = this;
    this.request({
        method: "HEAD", 
        url: this._webURL + "listen",
        success: function(data, res) {
            // @TODO replace with real cookie handling
            var cookies = {};
            res.headers['set-cookie'].forEach(function(c) {
                var pos = c.indexOf("=");
                if(pos > 0) cookies[c.substr(0, pos)] = c.substr(pos+1, c.indexOf(";")-(pos+1));
            });

            if (typeof cookies.xt !== "undefined") {
                success(cookies.xt);
            } else {
                error("xt cookie missing");
                console.log("xt cookie missing");
                return;
            }
        },
        error: function(data, err, res) {
            error("request for xt cookie failed");
            console.log("request for xt cookie failed:" + res.statusCode, data, err);
        }
    });
};

PlayMusic.prototype.getSettings = function(success, error) {
    var that = this;

    this.request({
        method: "POST",
        url: this._webURL + "services/loadsettings?" + querystring.stringify({u: 0, xt: this._xt}),
        contentType: "application/json",
        data: JSON.stringify({"sessionId": ""}), // @TODO make this.request auto serialize based on content type
        success: function(body, res) {
            var response = JSON.parse(body);
            that._allAccess = response.settings.isSubscription;

            var devices = response.settings.devices.filter(function(d) {
                return d.type === "PHONE";
            });
            //console.log("res.headers", res.headers);
            if(devices.length > 0) {
                success(devices[0].id.slice(2));
            } else {
                error("Unable to find a usable device on your account, access from a mobile device and try again");
            }
        },
        error: function(body, err, res) {
            error("error loading settings");
            //console.log("error loading settings", res.statusCode, body, err);
        }
    });
};

PlayMusic.prototype.getLibrary = function(callback) {
    if (this.hasOwnProperty('cachedRequest') && this.cachedRequest.time + this.cacheTime > Date.now()) {
        callback(this.cachedRequest.response);
    } else {
        var that = this;
        this.request({
            method: "POST",
            url: this._baseURL + "trackfeed",
            success: function(data, res) {
                that.cachedRequest = {
                    response: JSON.parse(data),
                    time: Date.now()
                };
                callback(that.cachedRequest.response);
            },
            error: function(data, err, res) {
                console.log("error in _getData", data, res.statusCode, err);
            }
        });
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
    this.request({
        method: "GET",
        url: this._mobileURL + 'mplay?' + qstring,
        options: { headers: { "X-Device-ID": this._deviceId } },
        success: function(data, res) {
            error("successfully retrieved stream urls, but wasn't expecting that...");  // @TODO FIX THIS!!!! see below note
            console.log(data);
        },
        error: function(data, err, res) {
            if(res.statusCode === 302) {
                // @TODO THIS SEEMS VERY WRONG.  I clearly have an issue that's causing the request to fail, probably should fix that instead of
                // just relying on the fact that it's still giving me a 302 to the correct stream URL
                callback(res.headers.location);
            } else {
                console.log("error getting stream urls", res.statusCode, data, err);
            }
        }
    });
};
module.exports = PlayMusic;
