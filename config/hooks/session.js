/*
 * caminio-auth
 *
 * @author quaqua <quaqua@tastenwerk.com>
 * @date 01/2014
 * @copyright TASTENWERK http://tastenwerk.com
 * @license MIT
 *
 */

var passport = require('passport');

module.exports = function( caminio ){

  caminio.hooks.define( 'after', 'session', 'setupPassport', afterSession );

  function afterSession( cb ){
  
    caminio.express.use( passport.initialize() );
    caminio.express.use( passport.session() );

    passport.serializeUser( serialize );
    passport.deserializeUser( deserialize );

    cb();

    function serialize(user, done) {
      done(null, user.id);
    }

    function deserialize( id, done ){
      caminio.models.User.findOne({ _id: id })
      .populate('camDomains')
      .exec( function(err, user ){
        if( err ){ return done( err ); }
        if( user ){
          if( !user.lastRequestAt || user.lastRequestAt.getTime() < (new Date()) - ( caminio.config.session.timeout ) )
            return done( null, null );
          user.update({ lastRequestAt: new Date() }, function( err ){
            done( err, user );
          });
        } else {
          done( err, user );
        }
      });
    }

  }

};