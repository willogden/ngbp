var MOUT = require( 'mout' );
var GRUNT = require( 'grunt' );

// The module to be exported.
var ngbp = module.exports = {};

// Get the version number
ngbp.version = require( './../package.json' ).version;

// Expose internal ngbp libs.
function nRequire(name) {
  return ngbp[name] = require( './ngbp/' + name );
}

// Expose module functions globally.
function nExpose ( o, fn, newFn ) {
  ngbp[ newFn || fn ] = o[ fn ].bind( o );
}

// Export some NGBP libs.
var TASK = nRequire( 'task' );
var CONFIG = nRequire( 'config' );
var BOWER = nRequire( 'bower' );
var PLUGINS = nRequire( 'plugins' );
var CLI = nRequire( 'cli' );
var LOG = nRequire( 'log' );
var OPTIONS = nRequire( 'options' );
var SCAFFOLD = nRequire( 'scaffold' );

// Globalize some methods from those libs.
nExpose( TASK, 'runTasks' );

// Expose the verbose logging methods globally.
ngbp.verbose = LOG.verbose;
ngbp.userconfig = CONFIG.user;

// If we're run from Grunt, we need to bootstrap ngbp when this library is first loaded. This is a
// dirty hack, I know...
if ( /grunt$/.test( process.argv[ 1 ] ) ) {
  CONFIG.bootstrap();
}

