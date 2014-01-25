var GRUNT = require( 'grunt' );
var PATH = require( 'path' );
var ASYNC = require( 'async' );
var MOUT = require( 'mout' );
var Q = require( 'q' );
var LOG = require( './log' );

/**
 * The list of modules that have already been loaded.
 */
var loadedModules = [];

/*
 * Get the user-specified modules from the package.json file.
 */
var getModules = module.exports.getModules = function getModules ( include_versions ) {
  var pkg = GRUNT.config.get( 'pkg' );
  var modules;

  if ( ! pkg ) {
    LOG.error( "I need a `pkg` variable in the Grunt config; skipping loading of ngbp plugins." );
    modules = [];
  } else if ( pkg.devDependencies ) {
    modules = MOUT.object.filter( pkg.devDependencies, function ( v, k ) {
      return k.indexOf( 'ngbp-' ) === 0;
    });
  } else {
    modules = [];
  }

  if ( ! include_versions ) {
    return MOUT.object.keys( modules );
  } else {
    return modules;
  }
};

/**
 * Check to see if a particular ngbp plugin (i.e. a node module) is installed locally.
 */
var isInstalled = module.exports.isInstalled = function isInstalled ( pkg ) {
  if ( GRUNT.file.exists( PATH.join( PATH.resolve( 'node_modules' ), pkg, 'tasks' ) ) ) {
    return true;
  } else {
    return false;
  }
};

/**
 * Load the set of provided plugins, but only if they're installed.
 */
var loadModules = module.exports.loadModules = function loadModules ( modules ) {
  modules.forEach( function ( mod ) {
    LOG.verbose.log( "Attempting to load: " + mod + "..." );
    if ( isInstalled( mod ) ) {
      GRUNT.loadNpmTasks( mod );
      loadedModules.push( mod );
    } else {
      GRUNT.verbose.writeln( "[ngbp] Skipping loading '" + mod + "' because it's not installed." );
    }
  });
};

/**
 * Load the provided plugin, installing it if necessary.
 */
var loadOrInstall = module.exports.loadOrInstall = function loadOrInstall ( modules ) {
  var deferred = Q.defer();

  ASYNC.eachSeries( modules, function ( mod, cb ) {
    // if we already loaded it, do nothing
    if ( loadedModules.indexOf( mod ) > -1 ) {
      cb();
    // else if it's installed but not loaded, load it
    } else if ( isInstalled( mod ) ) {
      GRUNT.loadNpmTasks( mod );
      loadedModules.push( mod );
      cb();
    // else install it
    } else {
      GRUNT.log.subhead( ( "Installing missing plugin " + mod + "..." ).blue );
      install( mod, cb );
    }
  }, function () {
    deferred.resolve( true );
  });

  return deferred.promise;
};

/**
 * Search the npm repository for ngbp packages.
 */

var search = module.exports.search = function search ( searchString, callback ) {
  var args = searchString.split( '+' );
  args.push( 'ngbpplugin' );
  args.unshift( 'search' );

  GRUNT.util.spawn({
    cmd: 'npm',
    args: args
  }, function ( err, result, code ) {
    if ( err ) {
      GRUNT.fail.fatal( result );
    } else {
      GRUNT.log.write( result );
    }

    callback();
  });
};

/**
 * Install a new ngbp module.
 */

var install = module.exports.install = function install ( pkgString, callback ) {
  var args = pkgString.split( '+' );
  args.unshift( '--save-dev' );
  args.unshift( 'install' );

  GRUNT.util.spawn({
    cmd: 'npm',
    args: args
  }, function ( err, result, code ) {
    if ( err ) {
      GRUNT.fail.fatal( result );
    } else {
      GRUNT.log.write( result );
    }

    // load the installed modules in case tasks are chained
    pkgString.split( '+' ).forEach( function ( mod ) {
      GRUNT.loadNpmTasks( mod );
      loadedModules.push( mod );
    });

    callback();
  });
};

/**
 * Uninstall an existing ngbp module.
 */

var uninstall = module.exports.uninstall = function uninstall ( pkgString, callback ) {
  var args = pkgString.split( '+' );
  args.unshift( '--save-dev' );
  args.unshift( 'uninstall' );

  GRUNT.util.spawn({
    cmd: 'npm',
    args: args
  }, function ( err, result, code ) {
    if ( err ) {
      GRUNT.fail.fatal( result );
    } else {
      GRUNT.log.write( result );
    }

    callback();
  });

  // TODO: unload the installed modules in case tasks are chained
};

