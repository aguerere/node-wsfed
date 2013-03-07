var express = require('express');
var http = require('http');
var wsfed = require('../../lib');
var xtend = require('xtend');
var fs = require('fs');
var path = require('path');

var fakeUser = {
  id: '12334444444',
  displayName: 'Jose Romaniello',
  name: {
    familyName: 'Romaniello',
    givenName: 'Jose'
  },
  emails: [
    {
      type: 'work',
      value: 'jfr@jfr.com'
    }
  ]
};

var credentials = {
  cert:     fs.readFileSync(path.join(__dirname, 'wsfed.test-cert.pem')),
  key:      fs.readFileSync(path.join(__dirname, 'wsfed.test-cert.key'))
};

module.exports.start = function(options, callback){
  if (typeof options === 'function') {
    callback = options;
    options = {};
  }

  var app = express();

  app.configure(function(){
    this.use(function(req,res,next){
      req.user = fakeUser;
      next();
    });



  });

  app.get('/wsfed/FederationMetadata/2007-06/FederationMetadata.xml',
      wsfed.metadata({
        cert:   credentials.cert,
        issuer: 'fixture-test'
      }));

  app.get('/wsfed/adfs/fs/federationserverservice.asmx',
      wsfed.federationServerService);
  
  //configure wsfed middleware
  app.get('/wsfed', 
      wsfed.auth(xtend({}, {
        issuer:             'fixture-test',
        callbackUrl:        'http://office.google.com',
        cert:               credentials.cert,
        key:                credentials.key
      }, options)));

  var server = http.createServer(app).listen(5050, callback);
  module.exports.close = server.close.bind(server);
};

module.exports.fakeUser = fakeUser;
module.exports.credentials = credentials;
