/*
 * camin.io
 *
 * @author quaqua <quaqua@tastenwerk.com>
 * @date 01/2014
 * @copyright TASTENWERK http://tastenwerk.com
 * @license MIT
 *
 */

module.exports = UserModel;

/**
 * The user class is the main user object
 * for any operations in caminio
 *
 * @class User
 */

function UserModel( caminio, mongoose ){
  
  var crypto    = require('crypto');
  var ObjectId  = mongoose.Schema.Types.ObjectId;
  var Mixed     = mongoose.Schema.Types.Mixed;

  //var MessageSchema = require('./_schemas/message.schema.js')( caminio, mongoose );

  /**
   *
   * @constructor
   *
   **/
  var schema = new mongoose.Schema({
        firstName: String,
        lastName: String,
        encrypted_password: {type: String, required: true},
        salt: {type: String, required: true},
        preferences: { type: Mixed, default: {} },
        //messages: [ MessageSchema ],
        lang: { type: String, default: 'en' },
        email: { type: String, 
                 lowercase: true,
                 required: true,
                 index: { unique: true },
                 validate: [EmailValidator, 'invalid email address'] },
        groups: [ { type: ObjectId, ref: 'Group' } ],
        domains: [ { type: ObjectId, ref: 'Domain' } ],
        confirmationKey: String,
        confirmationExpires: Date,
        confirmationTries: Number,
        role: { type: Number, default: 100 },
        lastLoginAt: Date,
        lastLoginIp: String,
        lastRequestAt: Date,
        createdAt: { type: Date, default: Date.now },
        createdBy: { type: ObjectId, ref: 'User' },
        updatedAt: { type: Date, default: Date.now },
        updatedBy: { type: ObjectId, ref: 'User' },
        lockedAt: { type: Date },
        lockedBy: { type: ObjectId, ref: 'User' },
        description: String,
        billing_information: {
          address: {
            street: String,
            zip: String,
            city: String,
            state: String,
            country: String,
            salutation: String,
            academicalTitle: String
          },
          email: { type: String, 
                   lowercase: true,
                   match: /@/ },
        },
        phone: {
          type: String,
          match: /^[\d]*$/
        }
  });

  /**
   * name.full virtual
   *
   * constructs a string which is definitely not null
   * and represents a (not unique) name of this user
   *
   * @method name.full
   * @return {String} full name of the user
   *
   * @example
   *
   *    user.name.full
   *    > Henry King
   *
   **/
  schema.virtual('fullName')
    .get( getUserFullName )
    .set( function( name ){
      if( name.split(' ') ){
        this.firstName = name.split(' ')[0];
        this.lastName = name.split(' ')[1];
      } else
        this.firstName = name;
    });

  /**
   *
   * set password for this user
   *
   * the password will be available for the rest of this 
   * instance's live-time. Only the encrytped version in 
   * property encrypted_password will be stored to the db
   *
   * @method password
   * @param {String} password
   *
   * @example
   *  
   *     user.password('test');
   *
  **/
  schema.virtual('password')
    .set(function( password ) {
      this._password = password;
      this.salt = this.generateSalt();
      this.encrypted_password = this.encryptPassword(password);
    })
    .get(function() { 
      return this._password; 
    });

  /**
  authenticate user

  compares encrytped password with given plain text password

    @method authenticate
    @param {String} plainTextPassword the plain text password which
  will be hase-compared against the original password saved to
  the database
  **/
  schema.method('authenticate', function(plainTextPassword) {
    return this.encryptPassword(plainTextPassword) === this.encrypted_password;
  });

  /**
  regenerateAuthToken

  regenerates the auth_token object by generating a
  new random hash and updating ip address of user

    @method regenerateAuthToken
    @param {String} ip address of user

  **/
  schema.method('regenerateAuthToken', function(ipAddress) {
    this.auth_token.token = this.encryptPassword(ipAddress);
    this.auth_token.ip_address = ipAddress;
    this.auth_token.at = new Date();
  });

  /**
  generate salt

  generate the password salt

    @method generateSalt
    @private
  **/
  schema.method('generateSalt', function() {
    return Math.round((new Date().valueOf() * Math.random())) + '';
  });

  /**

  encrypt password

    @param {String} password - clear text password string
  to be encrypted
  **/
  schema.method('encryptPassword', function(password) {
    return crypto.createHmac('sha256WithRSAEncryption', this.salt).update(password).digest('hex');
  });

  /**

  Reads domain, superuser attribute or role number
  If role number is less than equal 5, user is admin

    @method isAdmin
    @param {Domain|Group|ObjectId|String} groupOrDomain [optional] domain or group object, ObjectId of group/domain object or string of group/domain object id
    @return {Boolean} if the user is admin
  **/
  schema.method('isAdmin', function(groupOrDomain){
    if( this.isSuperUser() )
      return true;
    if( groupOrDomain instanceof orm.models.Domain )
      return groupOrDomain.owner.equals( this._id.toString() );
    return this.role <= 5;
  });

  schema.virtual('admin').get(function(){
    if( this.isSuperUser() )
      return true;
    return this.role <= 5;
  });

  schema.virtual('superuser').get(function(){
    return this.isSuperUser();
  });

  /**

    Return, if this user is a superuser.

    This method looks up in the app.config object for a superusers key. The email address of this user
    must be an array item of this key.

    @method isSuperUser
    @return {Boolean} if the user is superuser

    @example

      // ${APP_HOME}/config/environments/production.js
      ...
      config.superusers = [ 'admin@example.com' ];
      ...

  **/
  schema.method('isSuperUser', function(){
    return caminio.config.superusers && caminio.config.superusers.indexOf(this.email) >= 0;
  });

  /**
   * computes the user's full name
   * to display
   * in worst case, this is the user's email
   * address
   *
   * @method getUserFullName
   * @private
   *
   **/
  function getUserFullName(){
    if( this.firstName && this.lastName )
      return this.firstName + ' ' + this.lastName;
    else if( this.firstName )
      return this.firstName;
    else if( this.lastName )
      return this.lastName;
    else
      return this.email;
  }

  /**
   * validates, if email has at least @
   *
   * @method EmailValidator
   * @private
   *
   **/
  function EmailValidator( val ){
    if( !val ) return false;
    return val.match(/@/);
  }

  schema.publicAttributes = [
    'firstName',
    'lastName',
    'fullName',
    'email',
    'lastLoginAt',
    'lastRequestAt',
    'superuser',
    'admin'
  ];

  return schema;

}