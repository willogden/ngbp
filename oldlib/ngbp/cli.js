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
var CONFIG = require( './config' );
var LOG = require( './log' );
var TASK = require( './task' );
var SCAFFOLD = require( './scaffold' );
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
var ngbpTasks = [
    'build',
    'compile',
    'globs',
    'tasks',
    'bower',
    'plugins',
    'watch'
];

// What to run when nothing's been specified.
var defaultTasks = [ 'ngbp-build', 'ngbp-compile' ];

/**
 * Whether or not to run the default tasks. Some command-line options imply there's no need to run
 * any tasks and so may unset this flag, but it's enabled by default.
 */
var runDefaultTasks = true;

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

// The location of our templates.
var TEMPLATE_LOCATION = PATH.join( __dirname + './../../templates' );

// The locations of our templates, used in scaffolding new applications.
var webapp_templates = {
  'Gruntfile.js': TEMPLATE_LOCATION + '/webapp/Gruntfile.tpl.js',
  'Gruntfile.coffee': TEMPLATE_LOCATION + '/webapp/Gruntfile.tpl.coffee'
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
  write: {
    short: 'w',
    info: 'Write any configuration changes to `ngbp.json`, such as task preventions.',
    type: Boolean
  },
  prop: {
    info: 'Get a configuration value.',
    type: String
  },
  set: {
    short: 's',
    info: 'Set or change a configuration value. Must be used with --get. Use --write to save to ngbp.json.',
    type: String
  },
  json: {
    short: 'j',
    info: 'When setting a configuration value, process it as JSON.',
    type: Boolean
  },
  prevent: {
    short: 'p',
    info: 'A comma-separated list of tasks to prevent from running. Use --write to save to ngbp.json.',
    type: String
  },
  allow: {
    short: 'a',
    info: 'A comma-separated list of tasks to allow, overwriting whether they are prevented. Use ' +
      '--write to save to ngbp.json, if necessary.',
    type: String
  },
  inject: {
    short: 'i',
    info: 'Inject a task into the build process using the format task@hook#priority. E.g. ' +
      '"mytask:subtask@prebuild#20". This option can be repeated to inject multiple tasks. Use ' +
      '--write to save to ngbp.json.',
    type: [ Array, String ]
  },
  'inject-watch': {
    info: 'Inject a task into the watch process using the format task@glob#priority. E.g. ' +
      '"mytask:subtask@app.js#20". This option can be repeated to inject multiple tasks. Use ' +
      '--write to save to ngbp.json.',
    type: [ Array, String ]
  },
  raw: {
    info: 'When printing configuration values, do not process them as templates first. This will ' +
      'show the values as they were defined, rather than how they will appear during runtime.',
    type: Boolean
  },
  user: {
    short: 'u',
    info: 'Restrict configuration commands to your local ngbp configuration (ngbp.json).',
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
  var opts = {};
  var nopt;

  MOUT.object.forOwn( optionList, function( val, key ) {
    var short = val.short;
    if ( short ) {
      aliases[ short ] = '--' + key;
    }
    known[ key ] = val.type;
  });

  nopt = NOPT( known, aliases, process.argv, 2 );

  MOUT.object.forOwn( nopt, function ( val, key ) {
    opts[ MOUT.string.camelCase( key ) ] = val;
  });

  return opts;
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
  var ngbpInfo = {};

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

    LOG.subheader( "Scaffolding project configuration files" );
    LOG.log( "Writing out package.json" );
    return SCAFFOLD.toJson( packageInfo, PATH.join( process.cwd(), 'package.json' ) );
  })
  .then( function () {
    return readFile( 'bower.json' );
  }, function ( err ) {
    LOG.fatal( err );
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
    return SCAFFOLD.toJson( bowerInfo, PATH.join( process.cwd(), 'bower.json' ) );
  })
  .then( function () {
    return readFile( '.bowerrc' );
  }, function ( err ) {
    LOG.fatal( err );
  })
  .then( function ( bowerrc ) {
    bowerRcInfo = JSON.parse( bowerrc );

    if ( ! bowerRcInfo.vendor ) {
      bowerRcInfo.vendor = "vendor";

      LOG.log( "Adding `directory` property to .bowerrc" );
      return SCAFFOLD.toJson( bowerRcInfo, PATH.join( process.cwd(), '.bowerrc' ) );
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
    return SCAFFOLD.toJson( bowerRcInfo, PATH.join( process.cwd(), '.bowerrc' ) );
  })
  .then( function () {
    // If the bower vendor directory is not the ngbp default, add it to the ngbp info
    if ( bowerRcInfo.directory !== 'vendor' ) {
      MOUT.object.set( ngbpInfo, 'paths.vendor', bowerRcInfo.directory );
    }

    return oneOrMoreFileExists( gruntfileNames );
  }, function ( err ) {
    LOG.fatal( err );
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
    LOG.log( "Scaffolding ngbp.json" );
    return SCAFFOLD.toJson( ngbpInfo, PATH.join( process.cwd(), 'ngbp.json' ) );
  })
  .then( function () {
    LOG.log( "Scaffolding " + pathToGruntfile );
    return SCAFFOLD.copy( webapp_templates[ pathToGruntfile ], pathToGruntfile );
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
    LOG.fatal( err );
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
      var ngbpTaskRe = /^ngbp-(.+)$/i;

      var _options = Object.keys( optionList ).map( function( long ) {
        var o = optionList[ long ];
        var col1 = '--' + long + ( o.short ? ', -' + o.short : '' );
        col1len = Math.max( col1len, col1.length );
        return [ col1, o.info ];
      });

      var _tasks = TASK.getAllTasks().map( function ( name ) {
        var displayName = name;

        if ( ngbpTaskRe.test( name ) ) {
          displayName = name.match( ngbpTaskRe )[1];
        }

        if ( TASK.shouldPreventTask( name ) ) {
          displayName =  "*" + displayName;
        }

        col1len = Math.max( col1len, displayName.length );
        return [ displayName, TASK.getTaskInfo( name ) ];
      });
      _tasks.push( [ 'init', 'Create a new ngbp project in the current directory.' ] );

      // Print out the options
      // TODO(jdm): categorize these so they are easier to follow.
      LOG.subheader( 'Options' );
      _options.forEach( function( item ) {
        LOG.writetableln(
          [ 1, col1len, 2, 76 - col1len ],
          [ '', MOUT.string.lpad( item[0], col1len ), '', item[1] ]
        );
      });

      // Print out available tasks
      // TODO(jdm): categorize these so they are easier to follow.
      LOG.subheader( 'Available Tasks (* = prevented)' );
      _tasks.sort().forEach( function( item ) {
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
        runDefaultTasks = false;
        return init();
      } else {
        return true;
      }
    })
    .then( function () {
      var tasks = [];

      /**
       * There are some option combinations that imply we don't need to run default tasks if none
       * were provided:
       *   - When saving options to disk
       *   - When getting a configuration value while not setting one
       *
       */
      if ( options.write || ( options.prop && ! options.set ) ) {
        runDefaultTasks = false;
      }

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
          if ( ngbpTasks.indexOf( task.split( ':' )[0] ) >= 0 ) {
            tasks.push( 'ngbp-' + task );
          } else {
            tasks.push( task );
          }
        });

        // If tasks were specified, we don't need to run the default ones
        if ( tasks.length > 0 ) {
          runDefaultTasks = false;
        }
      
        // If we need to, set the default tasks to run.
        if ( runDefaultTasks ) {
          tasks = defaultTasks;
        }
      }

      // Initialize ngbp so we can mess with the config, if needed.
      TASK.init( tasks );

      if ( options.prevent ) {
        // merge the additional tasks into the prevent array
        CONFIG.user( 'prevent', options.prevent.split( ',' ), true );
      }

      if ( options.allow ) {
        var prevent = CONFIG.user( 'prevent' ) || [];
        var allow = options.allow.split( ',' );
        var newPrevent = [];

        prevent.forEach( function ( p ) {
          if ( ! MOUT.array.contains( allow, p.split( ':' )[0] ) && ! MOUT.array.contains( allow, p ) ) {
            newPrevent.push( p );
          }
        });

        // replace the prevent array with the new one
        CONFIG.user( 'prevent', newPrevent );
      }

      if ( options.set ) {
        var key = options.prop;
        var val = options.set;

        if ( options.json ) {
          val = JSON.parse( val, null, " " );
        }

        if ( ! key ) {
          LOG.fatal( "You must specify the configuration key with --get." );
        }

        CONFIG.user( key, val, true );
      }

      if ( options.prop ) {
        var get;
        var val;
        var key = options.prop;
      
        if ( options.user ) {
          get = options.raw ? CONFIG.user.getRaw : CONFIG.user;
        } else {
          get = options.raw ? CONFIG.getRaw : CONFIG;
        }

        LOG.header( "Configuration" );
        LOG.subheader( "Key: " + key );

        // TODO(jdm): Support --raw and set the default to get the template-processed version.
        val = JSON.stringify( get( key ), null, "  " );
        if ( val ) {
          LOG.writeln( val );
        } else {
          LOG.warning( "(not found)" );
        }
      }

      if ( options.inject && options.inject.length > 0 ) {
        var m;
        var re = /^([a-zA-Z0-9_:-]+)@([a-zA-Z]+)#(\d+)$/;
        var injections = CONFIG.user( 'inject' );

        options.inject.forEach( function myFunction ( i ) {
          m = i.match( re );

          if ( m.length !== 4 ) {
            LOG.fatal( "--inject expects items in the form of task@hook#priority. Bad format for: " + i );
          }

          injections.push({
            when: m[ 2 ],
            task: m[ 1 ],
            priority: parseInt( m[ 3 ], 10 )
          });
        });

        CONFIG.user( 'inject', injections );
      }

      if ( options.injectWatch && options.injectWatch.length > 0 ) {
        var m;
        var re = /^([a-zA-Z0-9_:-]+)@([a-zA-Z\.]+)#(\d+)$/;
        var injections = CONFIG.user( 'inject' );

        options.injectWatch.forEach( function myFunction ( i ) {
          m = i.match( re );

          if ( m.length !== 4 ) {
            LOG.fatal( "--inject-watch expects items in the form of task@glob#priority. Bad format for: " + i );
          }

          injections.push({
            when: 'watch',
            glob: m[ 2 ],
            task: m[ 1 ],
            priority: parseInt( m[ 3 ], 10 )
          });
        });

        CONFIG.user( 'inject', injections );
      }

      // Load 'em up, lock n' load, rock n' roll, make it so. Engage!
      return TASK.runTasks( tasks );
    })
    .then( function () {
      // Run pre-task option-triggered commands
      if ( options.write ) {
        return CONFIG.write();
      } else {
        return true;
      }
    });
  }

  return promise
  .then( function () {
    LOG.verbose.success( 'ngbp completed successfully.' );
  })
  .catch( function ( err ) {
    LOG.fatal( err );
  });
};

