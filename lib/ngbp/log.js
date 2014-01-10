var COLORS = require( 'colors' );
var OPTIONS = require( './options' );
var UTIL = require( './util' );
var GRUNTLOG = require( 'grunt' ).log;

var log = {};
var prefix = true;

// TODO(jdm): include timestamp
function wrap ( msg, newline ) {
  return ( newline ? "\n" : "" ) + ( prefix ? "[ngbp] " : "" ) + ( msg || "" );
}

log.error = function error ( msg ) {
  var oldPrefix = prefix;
  prefix = true;
  console.log( wrap( msg ).red );
  prefix = oldPrefix;
};

log.fatal = function fatal ( error, code ) {
  if ( typeof error === 'object' ) {
    log.error( error.toString() );

    if ( error.stack && ( OPTIONS.stack || OPTIONS.debug ) ) {
      console.error( error.stack );
    }
  } else {
    log.error( error );
  }

  // TODO(jdm): Should support more sophisticated and standard error codes
  UTIL.exit( code || 1 );
};

log.warning = function error ( msg ) {
  console.log( wrap( msg ).yellow );
};

log.header = function header ( msg ) {
  console.log( wrap( msg, true ).bold.underline.cyan );
};

log.subheader = function subheader ( msg ) {
  console.log( wrap( msg, true ).bold.magenta );
};

log.success = function emphasize ( msg ) {
  console.log( wrap( msg ).bold.green );
};

log.log = function log ( msg ) {
  console.log( wrap( msg ) );
};

log.writeln = function writeln ( msg ) {
  console.log( msg || "" );
};

log.writetableln = GRUNTLOG.writetableln;

log.disablePrefix = function () {
  prefix = false;
};

log.enablePrefix = function () {
  prefix = true;
};

// Create verbose versions of the log functions.
// Totally ripped from Grunt.
log.verbose = {};
log.notverbose = {};

Object.keys( log )
.filter( function( key ) {
  return typeof log[ key ] === 'function';
})
.forEach( function ( key ) {

  log.verbose[ key ] = function() {
    if ( OPTIONS.verbose ) {
      log[ key ].apply( log, arguments );
    }

    return log.verbose;
  };

  log.notverbose[ key ] = function() {
    if ( ! OPTIONS.verbose ) {
      log[ key ].apply( log, arguments );
    }

    return log.notverbose;
  };
});

// A way to switch between verbose and notverbose modes. For example, this will
// write 'foo' if verbose logging is enabled, otherwise write 'bar':
// verbose.write('foo').or.write('bar');
log.verbose.or = log.notverbose;
log.notverbose.or = log.verbose;

module.exports = log;

