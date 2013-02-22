var templates = require('./templates');
var PassportProfile = require('./claims/PassportProfile');
var tokenGenerator = require('./tokenGenerator');
var util = require('./util');


function metadataMiddleware (claimTypes, issuer, pem, endpointPath) {
  return function (req, res, next) {
    endpointPath = endpointPath || 
      (req.originalUrl.substr(0, req.originalUrl.length - '/FederationMetadata/2007-06/FederationMetadata.xml'.length));
    
    var protocol = req.headers['x-iisnode-https'] && req.headers['x-iisnode-https'] == 'ON' ? 
                   'https' : 
                   (req.headers['x-forwarded-proto'] || req.protocol);

    var endpoint = protocol + '://' + req.headers['host'] + endpointPath;

    res.set('Content-Type', 'application/xml');
    res.send(templates.metadata({
      claimTypes: claimTypes,
      pem:        pem,
      issuer:     issuer,
      endpoint:   endpoint
    }).replace(/\n/g, ''));
  };
}

/**
 * WSFederation middleware.
 *
 * This middleware creates a WSFed endpoint based on the user logged in identity.
 *
 * options:
 * - profileMapper(profile) a function that given a user returns a claim based identity, also contains the metadata. By default maps from Passport.js user schema (PassportProfile).
 * - getUserFromRequest(req) a function that given a request returns the user. By default req.user
 * - validateAudience(clientId, callback) a function that given a client id (wtrealm) returns a client with key, cert and callbacks. Defaults all valid.
 * - issuer string
 * - cert the public certificate
 * - key the private certificate to sign all tokens
 * - callbackUrl
 * 
 * @param  {[type]} options [description]
 * @return {[type]}         [description]
 */
module.exports = function(options) {
  options = options || {};
  options.profileMapper = options.profileMapper || PassportProfile;
  options.getUserFromRequest = options.getUserFromRequest || function(req){ return req.user; };
  options.validateAudience = options.validateAudience || function(aud, cb) { cb(null); };

  var pem = util.pemToCert(options.cert);

  var mdMiddleware = metadataMiddleware(
          options.profileMapper.metadata, 
          options.issuer, 
          pem,
          options.endpointPath);

  var middleware = function (req, res, next) {
    if(req.path.match(/FederationMetadata\/2007-06\/FederationMetadata.xml$/i)){
      return mdMiddleware(req, res, next);
    }

    var audience = req.query.wtrealm && 
                    req.query.wtrealm.indexOf(':') >= 0 ?
                    req.query.wtrealm.split(':').slice(1).join(':') : null;

    var user = options.getUserFromRequest(req);
    
    if(!user) return res.send(401);

    var claims = options.profileMapper(user);
    
    options.validateAudience(audience, function (err) {
      if(err) return next(err);

      //audience, issuer, cert, key, claims, wctx
      var wresult = tokenGenerator.generate(
            audience, 
            options.issuer, 
            options.cert, 
            options.key, 
            claims, 
            req.query.wctx);

      res.set('Content-Type', 'text/html');

      res.send(templates.form({
        callback: options.callbackUrl,
        wresult:  wresult,
        wctx:     req.query.wctx
      }));

    });

  };

  middleware.metadataMiddleware = mdMiddleware;

  return middleware;
};