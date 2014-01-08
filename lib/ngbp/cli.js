// Node.js imports
var SPAWN = require( 'child_process' ).spawn;
var FS = require( 'fs' );
var PATH = require( 'path' );

// 3rd-party libraries
var Q = require( 'q' );
var ASYNC = require( 'async' );
var NOPT = require( 'nopt' );
var GRUNT = require( 'grunt' );
var MOUT = require( 'mout' );
var PROMPT = require( 'prompt' );

// ngbp imports
var OPTIONS = require( './options' );
var LOG = require( './log' );
var TASK = require( './task' );
var PKG = require( './../../package.json' );

/**
 * Promise wrappers
 */
var readFile = Q.denodeify( FS.readFile );
var writeFile = Q.denodeify( FS.writeFile );
var promptGet = Q.nbind( PROMPT.get, PROMPT );

/**
 * Variables
 */
var options;

// For which grunt files should we look.
var gruntfileNames = [ 'Gruntfile.js', 'Gruntfile.coffee' ];

// List of ngbp tasks; used to prefix them with "ngbp-" when specified.
var ngbpTasks = [ 'build', 'compile', 'globs', 'tasks', 'bower', 'plugins', 'watch' ];

// What to run when nothing's been specified.
var defaultTasks = [ 'ngbp-build', 'ngbp-compile' ];

// Default ngbp modules for new projects
var defaultDevDependencies = {
  "ngbp": "~0.4",
  "ngbp-contrib-clean": "~0.0.1",
  "ngbp-contrib-copy": "~0.0.1",
  "ngbp-contrib-tpl": "~0.0.1",
  "ngbp-contrib-lintjs": "~0.0.1",
  "ngbp-contrib-lintcss": "~0.0.1",
  "ngbp-contrib-mincss": "~0.0.1",
  "ngbp-contrib-minjs": "~0.0.1"
};

// Supported command-line arguments and flags.
var optionList = {
  help: {
    short: 'h',
    info: 'Display this help text.',
    type: Boolean
  },
  version: {
    short: 'V',
    info: 'Print the ngbp version.',
    type: Boolean
  },
  debug: {
    short: 'd',
    info: 'Enable debugging mode for tasks that support it.',
    type: [Number, Boolean]
  },
  stack: {
    info: 'Print a stack trace when exiting with a warning or fatal error.',
    type: Boolean
  },
  force: {
    short: 'f',
    info: 'A way to force your way past warnings. Want a suggestion? Don\'t use this option, fix your code.',
    type: Boolean
  },
  verbose: {
    short: 'v',
    info: 'Verbose mode. A lot more information output.',
    type: Boolean
  },
  passthrough: {
    short: 'P',
    info: 'Pass all options directly through to Grunt. This normally isn\'t needed.',
    type: Boolean
  },
  coffee: {
    info: 'When creating a new ngbp app, scaffold the Gruntfile in CoffeeScript instead of JavaScript.',
    type: Boolean
  },
  'app-name': {
    info: 'When creating a new ngbp app, the name of the app to create.',
    type: String
  },
  'app-version': {
    info: 'When creating a new ngbp app, the version of the app to create.',
    type: String
  },
  'app-author': {
    info: 'When creating a new ngbp app, the author of the app to create.',
    type: String
  }
};

/**
 * Parse command line options.
 */
function processOptions () {
  // Parse `optlist` into a form that nopt can handle.
  var aliases = {};
  var known = {};

  Object.keys( optionList ).forEach( function( key ) {
    var short = optionList[ key ].short;
    if ( short ) {
      aliases[ short ] = '--' + key;
    }
    known[ key ] = optionList[ key ].type;
  });

  return NOPT( known, aliases, process.argv, 2 );
}

/**
 * Convenience method for determining if at least one in an array of files exists. Returns a
 * promise.
 */
function oneOrMoreFileExists ( files ) {
  var deferred = Q.defer();
  var exists = false;
  var contents;
  var path;

  ASYNC.each( files, function ( file, cb ) {
    FS.readFile( file, function ( err, data ) {
      if ( ! err ) {
        exists = true;
        contents = data;
        path = file;
      }

      cb();
    });
  }, function () {
    if ( exists ) {
      deferred.resolve({ path: path, contents: contents });
    } else {
      deferred.reject( false );
    }
  });

  return deferred.promise;
}

/**
 * Create a new ngbp project in the current directory.
 */
function init () {
  var pathToGruntfile = options.coffee ? 'Gruntfile.coffee' : 'Gruntfile.js';
  var packageInfo;
  var bowerInfo;
  var bowerRcInfo;
  var pathToVendorFiles;

  LOG.header( "Initializing new ngbp project" );

  // TODO(jdm): We should probably check to ensure we are not nested within a Node or Grunt project.

  // FIXME(jdm): these promises should be cleaned up a little so we get no bleed in the error
  // handlers.
  // Read in package.json, defaulting to barebones if not present
  return readFile( 'package.json' )
  .then( function ( contents ) {
    var pkg = JSON.parse( contents );

    if ( ! pkg.devDependencies ) {
      pkg.devDependencies = defaultDevDependencies;
    } else if ( Object.keys( pkg.devDependencies ).indexOf( 'ngbp' ) === -1 ) {
      // If ngbp isn't in the devDependencies, we can safely assume the user hasn't created a set of
      // custom ngbp plugins, so we should give the default. Otherwise, we'll just assume she
      // already included what she wants to include.
      pkg.devDependencies = MOUT.object.merge( pkg.devDependencies, defaultDevDependencies );
    }

    return pkg;
  }, function () {
    // TODO(jdm): support scaffolding options, like the ability to add AngularJS support.
    return {
      devDependencies: defaultDevDependencies
    };
  })
  .then( function ( pkg ) {
    packageInfo = pkg;

    // Prompt for name, author, and version
    PROMPT.start();
    PROMPT.override = options;
    return promptGet({
      properties: {
        'app-name': {
          description: 'Enter the name of your new app',
          pattern: /[a-zA-Z0-9-_]+/,
          message: 'The app name can only contain letters, numbers, dashes, and underscores.',
          required: true,
          default: packageInfo.name || PATH.basename( process.cwd() )
        },
        'app-author': {
          description: 'Enter your name as it should appear in `package.json`',
          required: true,
          default: packageInfo.author || process.env[ 'USER' ]
        },
        'app-version': {
          description: 'Enter in the version at which to start your app',
          pattern: /^([0-9]+)\.([0-9]+)\.([0-9]+)(?:-([0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*))?(?:\+[0-9A-Za-z-]+)?$/,
          message: 'Version must follow Semantic Versioning (semver.org).',
          required: true,
          default: packageInfo.version || '0.0.1'
        }
      }
    });
  })
  .then( function ( promptedValues ) {
    // Save prompted values to packageInfo
    packageInfo.name = promptedValues[ 'app-name' ];
    packageInfo.author = promptedValues[ 'app-author' ];
    packageInfo.version = promptedValues[ 'app-version' ];

    // TODO: replace file writing here with a template-based scaffold
    LOG.subheader( "Scaffolding project configuration files" );
    LOG.log( "Writing out package.json" );
    return writeFile( 'package.json', JSON.stringify( packageInfo, null, "  " ) );
  })
  .then( function () {
    return readFile( 'bower.json' );
  }, function ( err ) {
    console.log("err", err);
    console.log("err stack", err.stack);
    LOG.fatal( "Could not write `package.json` to disk: " + err.toString() );
  })
  .then( function ( contents ) {
    return ( bowerInfo = JSON.parse( contents ) );
  }, function () {
    // scaffold bower.json
    bowerInfo = {
      name: packageInfo.name,
      version: packageInfo.version
    };

    LOG.log( "Scaffolding bower.json" );
    return writeFile( 'bower.json', JSON.stringify( bowerInfo, null, "  " ) );
  })
  .then( function () {
    return readFile( '.bowerrc' );
  }, function ( err ) {
    LOG.fatal( "Error processing bower.json: " + err.toString() );
  })
  .then( function ( bowerrc ) {
    bowerRcInfo = JSON.parse( bowerrc );

    if ( ! bowerRcInfo.vendor ) {
      bowerRcInfo.vendor = "vendor";

      LOG.log( "Adding `directory` property to .bowerrc" );
      return writeFile( '.bowerrc', JSON.stringify( bowerRcInfo, null, "  " ) );
    } else {
      return true;
    }
  }, function () {
    // No .bowerrc, so scaffold one with the vendor dir
    bowerRcInfo = {
      directory: "vendor",
      json: "bower.json"
    };

    LOG.log( "Scaffolding .bowerrc" );
    return writeFile( '.bowerrc', JSON.stringify( bowerRcInfo, null, "  " ) );
  })
  .then( function () {
    return oneOrMoreFileExists( gruntfileNames );
  }, function ( err ) {
    LOG.fatal( "Error processing .bowerrc: " + err.toString() );
  })
  .then( function ( gruntfile ) {
    pathToGruntfile = 'Gruntfile.new.js';

    LOG.warning( "You already have a Gruntfile at " + gruntfile.path
      + ". You'll need to manually merge the one I've created at " + pathToGruntfile + "." );

    return true;
  }, function () {
    // If there's no Gruntfile, we don't need to do anything because we'll scaffold it in the next
    // step anyway.
    return true;
  })
  .then( function () {
    // Scaffold a minimal gruntfile, with vendor path if needed
    var gruntfile;
    var customVendorDir = ( bowerRcInfo.directory !== 'vendor' );

    if ( options.coffee ) {
      gruntfile = [
        'module.exports = ( grunt ) ->',
        '  grunt.config.init',
        '    pkg: grunt.file.readJSON( "./package.json" )',
        "\n",
      ].join( "\n" );
      
      if ( customVendorDir ) {
        gruntfile = gruntfile + [
          '    ngbp:',
          '      paths:',
          '        vendor: "' + bowerRcInfo.directory + '"',
          "\n"
        ].join( "\n" );
      }

      gruntfile = gruntfile + [
        '  # Load ngbp',
        '  grunt.loadNpmTasks "ngbp"',
        "\n"
      ].join( "\n" );
    } else {
      gruntfile = [
        'module.exports = function ( grunt ) {',
        '  grunt.config.init({',
        '    pkg: grunt.file.readJSON( "./package.json" )' + ( customVendorDir ? ',' : '' ),
        "\n",
      ].join( "\n" );
      
      if ( customVendorDir ) {
        gruntfile = gruntfile + [
          '    ngbp: {',
          '      paths: {',
          '        vendor: "' + bowerRcInfo.directory + '"',
          '      }',
          '    }',
          '  });',
          "\n"
        ].join( "\n" );
      }

      gruntfile = gruntfile + [
        '  // Load ngbp',
        '  grunt.loadNpmTasks( "ngbp" );',
        '};',
        ''
      ].join( "\n" );
    }

    LOG.log( "Scaffolding Gruntfile to: " + pathToGruntfile );
    return writeFile( pathToGruntfile, gruntfile );
  })
  .then( function () {
    var deferred = Q.defer();

    /**
     * Finally, run `npm install` to install any necessary packages from the `package.json`.
     */
    LOG.subheader( "Running `npm install`..." );
    var npm = SPAWN( 'npm', [ 'install' ], {
      cwd: process.cwd()
    });

    npm.stderr.on( 'data', function ( data ) {
      if (/^execvp\(\)/.test( data ) ) {
        deferred.reject( "Could not launch NPM." );
      }
    });

    npm.stdout.pipe( process.stdout );
    npm.stderr.pipe( process.stderr );

    npm.on( 'close', function ( code ) {
      if ( code === 0 ) {
        deferred.resolve( true );
      } else {
        deferred.reject( "NPM exited with status " + code + "." );
      }
    });

    return deferred.promise;
  }, function ( err ) {
    LOG.fatal( "Could not scaffold Gruntfile: " + err.toString() );
  });
}

/**
 * Get the cli options
 */
options = processOptions();

/**
 * The exported method that is executed, e.g. by `ngbp-cli`.
 */
module.exports = function cli () {
  var isNewProject = false;
  var promise;

  // Save the options globally.
  OPTIONS.init( options );

  if ( ! options.passthrough && options.version ) {
    promise = Q.try( function () {
      LOG.writeln( 'ngbp v' + PKG.version );
      LOG.writeln( 'grunt v' + GRUNT.version);

      GRUNT.log.muted = true;
      GRUNT.task.init( [], { help: true } );
      GRUNT.log.muted = false;

      // Display available tasks (for shell completion, etc).
      var _tasks = Object.keys( GRUNT.task._tasks ).sort();
      LOG.verbose.writeln( 'Available tasks: ' + _tasks.join( ' ' ) );

      // Display available options (for shell completion, etc).
      var _options = [];
      Object.keys( optionList ).forEach( function( long ) {
        var o = optionList[ long ];
        _options.push( '--' + ( o.negate ? 'no-' : '' ) + long);
        if ( o.short ) { _options.push( '-' + o.short ); }
      });
      LOG.verbose.writeln( 'Available options: ' + _options.join( ' ' ) );

      return true;
    });
  } else if ( ! options.passthrough && options.help ) {
    promise = Q.try( function () {
      LOG.disablePrefix();

      LOG.header( 'ngbp v' + PKG.version );
      var col1len = 0;

      var _options = Object.keys( optionList ).map( function( long ) {
        var o = optionList[ long ];
        var col1 = '--' + long + ( o.short ? ', -' + o.short : '' );
        col1len = Math.max( col1len, col1.length );
        return [ col1, o.info ];
      });

      var _tasks = TASK.getAllTasks().map( function ( name ) {
        col1len = Math.max( col1len, name.length );
        return [ name, TASK.getTaskInfo( name ) ];
      });
      _tasks.push( [ 'init', 'Create a new ngbp project in the current directory.' ] );

      // Print out the options
      LOG.subheader( 'Options' );
      _options.forEach( function( item ) {
        LOG.writetableln(
          [ 1, col1len, 2, 76 - col1len ], 
          [ '', MOUT.string.lpad( item[0], col1len ), '', item[1] ]
        );
      });

      // Print out available tasks
      LOG.subheader( 'Available Tasks' );
      _tasks.forEach( function( item ) {
        LOG.writetableln(
          [ 1, col1len, 2, 76 - col1len ], 
          [ '', MOUT.string.lpad( item[0], col1len ), '', item[1] ]
          );
      });

      if ( _tasks.length === 1 ) {
        LOG.writeln();
        LOG.warning( "No ngbp plugins are available." );
      }

      LOG.enablePrefix();

      return true;
    });
  } else if ( options.argv.remain.indexOf( 'init' ) >= 0 ) {
    promise = init();
  } else {
    promise = oneOrMoreFileExists( gruntfileNames )
    .then( function () {
      return Q( true );
    }, function () {
      isNewProject = true;
      return Q( false );
    })
    .then( function () {
      return readFile( 'package.json' );
    })
    .then( function () {
      return Q( true );
    }, function () {
      isNewProject = true;
      return Q( false );
    })
    .then( function () {
      if ( isNewProject ) {
        return init();
      } else {
        var tasks = [];

        // If `--passthrough`, don't do anything but pass along to ngbp; this preserves certain
        // options for Grunt. Otherwise, check for options we need to process here and create a
        // list of tasks to run.
        if ( options.passthrough ) {
          tasks = options.argv.remain;
        } else {
          // Not a new project and no secial handling necessary, so create a task list from the args
          // and execute with grunt. Obviously, every argument passed to the command line that hasn't
          // been consumed by the options parser should be regarded as a task to execute.
          options.argv.remain.forEach( function ( task ) {
            if ( ngbpTasks.indexOf( task ) >= 0 ) {
              tasks.push( 'ngbp-' + task );
            } else {
              tasks.push( task );
            }
          });

          // If there aren't any tasks, run the default ones.
          if ( ! tasks.length ) {
            tasks = defaultTasks;
          }
        }

        // Load 'em up, lock n' load, rock n' roll, make it so. Engage!
        return TASK.runTasks( tasks, options );
      }
    });
  }

  return promise
  .then( function () {
    if ( options.verbose ) {
      LOG.success( 'ngbp completed successfully.' );
    }
  }, function ( err ) {
    if ( options.debug ) {
      console.error( err.stack );
    }

    LOG.fatal( "Well, shoot-darn! Something went wrong: " + err.toString() );
  });
};

