var ngbp = require( '../index' );
var MERGE = require( 'deepmerge' );
var MOUT = require( 'mout' );

/**
 * The NGBP Grunt task definition.
 */
module.exports = function ( grunt ) {
  /**
   * The merged options from the defaults and from the user's Grunt config.
   */
  var options;

  /**
   * The list of ngbp modules from the package.json file.
   */
  var modules = [];

  /**
   * For all user-specified modules, load 'em up; then inject all user-specified tasks.
   */
  function prepareTaskList ( callback ) {
    ngbp.plugins.loadOrInstall( modules, function () {
      /**
       * Now validate any user-specified tasks and then inject them.
       */
      options.inject.forEach( function ( task ) {
        if ( ! task.task ) {
          grunt.fail.fatal( "Injection error: you cannot inject a task without a 'task'." );
        }
        if ( ! task.priority ) {
          grunt.fail.fatal( "Injection error: you cannot inject a task without a 'priority'." );
        }
        if ( ! task.when ) {
          grunt.fail.fatal( "Injection error: you cannot inject a task without specifying 'when'." );
        }

        if ( task.when === 'watch' ) {
          if ( ! task.glob ) {
            grunt.fail.fatal( "Injection error: watch tasks need a 'glob' at which change to run." );
          }

          ngbp.task.injectWatch( task.glob, task.task, task.priority );
        } else {
          ngbp.task.injectHook( task.when, task.task, task.priority );
        }

      });

      // We're done loading modules
      callback();
    });
  }

  /**
   * Checks user configuration to see if a certain task should be ignored.
   */
  function preventTask ( task ) {
    if ( options.prevent.indexOf( task ) >= 0 || options.prevent.indexOf( task.split( ':' )[0] ) >= 0 ) {
      return true;
    } else {
      return false;
    }
  }

  /**
   * From a list of tasks, check if we should ignore them and run them if we shouldn't.
   */
  function runTasks ( tasks ) {
    tasks.forEach( function forEachTask ( task ) {
      if ( preventTask( task.taskName ) ) {
        grunt.log.writeln( "Prevented run of " + task.taskName );
      } else {
        grunt.task.run( task.taskName );
      }
    });
  }

  /********************************************************************************/

  /**
   * Prints out the list of defined globs.
   */
  function globs () {
    var done = this.async();

    prepareTaskList( function () {
      var val;
      var key = 'ngbp.globs';

      if ( grunt.option( 'raw' ) ) {
        val = JSON.stringify( grunt.config.getRaw( key ), {}, "  " );
      } else {
        val = JSON.stringify( grunt.config.get( key ), {}, "  " );
      }

      grunt.log.writeln( "Globs:".magenta );
      grunt.log.writeln( val );

      done();
    });
  };

  /**
   * Prints out the set of hooked tasks.
   */
  function tasks ( subset ) {
    var done = this.async();

    prepareTaskList( function () {
      var hooks = ngbp.task.getHooks();
      var watches = ngbp.task.getWatches();
      var ignore, globKey;

      function printTasks ( name, tasks, indent ) {
        grunt.log.writeln( "\n" + name.blue );
        if ( tasks ) {
          tasks.forEach( function ( task ) {
            ignore = preventTask( task.taskName ) ? ' (prevented)' : '';
            grunt.log.writeln( indent + task.priority + " - " + task.taskName + ignore.yellow );
          });

          if ( ! tasks.length ) {
            grunt.log.writeln( indent + "(none)" );
          }
        } 
      }

      if ( subset && subset !== 'watch' ) {
        grunt.log.subhead( "Tasks:".magenta );

        if ( hooks[ subset ] ) {
          printTasks( subset, hooks[ subset ], " " );
        } else {
          grunt.fail.warn( "Unknown hook: " + subset );
        }
      } else if ( ! subset ) {
        grunt.log.subhead( "Tasks:".magenta );

        for ( key in hooks ) {
          printTasks( key, hooks[ key ], "  " );
        };
      }

      if ( ! subset || subset == 'watch' ) {
        grunt.log.subhead( "Watches:".magenta );

        Object.keys( watches ).sort().forEach( function ( key ) {
          globKey = MOUT.string.unCamelCase( key, '.' );
          glob = grunt.option( 'raw' ) ? grunt.config.getRaw( "ngbp.globs." + globKey )
            : grunt.config.get( "ngbp.globs." + globKey );
          printTasks( globKey + ": " + glob, watches[ key ], "  " );
        });
      }

      done();
    });
  };

  /**
   * Perform the prebuild, build, and postbuild tasks according to the priority
   * with which they registered.
   */
  function build () {
    var done = this.async();

    prepareTaskList( function () {
      var build_steps = [ 'prebuild', 'build', 'postbuild' ];
      var hooks = ngbp.task.getHooks();

      build_steps.forEach( function forEachBuildStep ( step ) {
        runTasks( hooks[ step ] );
      });

      done();
    });
  };

  /**
   * Perform the precompile, compile, and postcompile tasks according to the priority
   * with which they registered.
   */
  function compile () {
    var done = this.async();

    prepareTaskList( function () {
      var compile_steps = [ 'precompile', 'compile', 'postcompile' ];
      var hooks = ngbp.task.getHooks();

      compile_steps.forEach( function forEachCompileStep ( step ) {
        runTasks( hooks[ step ] );
      });

      done();
    });
  };

  /**
   * Prepares and then runs the watch command.
   */
  function watch () {
    var done = this.async();
    var watchConfig = {};
    var watches, globKey, patterns;

    prepareTaskList( function () {
      watches = ngbp.task.getWatches();

      for ( key in watches ) {
        // Get the glob key from the slugified version and then fetch the file patterns.
        globKey = MOUT.string.unCamelCase( key, '.' );
        patterns = grunt.config.getRaw( 'ngbp.globs.' + globKey );

        // These are the tasks that need to be run for this glob.
        var tasks = [];
        watches[ key ].forEach( function ( task ) {
          tasks.push( task.taskName );
        })

        // Create a new watch config entry for it.
        watchConfig[ key ] = {
          files: patterns,
          tasks: tasks
        };
      };

      // Load the config into Grunt; we just overwrite it as merging would not make a lot of sense.
      grunt.loadNpmTasks( 'grunt-contrib-watch' );
      grunt.config.set( 'watch', watchConfig );

      // Finally, run the task.
      grunt.task.run( 'watch' );
      
      done();
    });
  }

  /**
   * Manage packages through Bower
   */
  function bower ( cmd, pkg ) {
    var done = this.async();
    ngbp.bower.run( cmd, pkg ).then( function () {
      done();
    });
  }

  /**
   * Manage ngbp plugins through NPM
   */
  function plugins ( cmd, arg2 ) {
    var done = this.async();

    // print a list of installed tasks if requested...or if no command was supplied
    if ( ! cmd || cmd === '' || cmd === 'list' ) {
      grunt.log.writeln( "Current Modules".magenta );
      modules.forEach( function ( mod ) {
        grunt.log.writeln( mod + ( ! ngbp.plugins.isInstalled( mod ) ? ' (not installed)' : '' ) );
      });

      done();
    } else {
      switch ( cmd ) {
        case 'search':
          ngbp.plugins.search( arg2, function () {
            done();
          });
          break;
        case 'install':
          ngbp.plugins.install( arg2, function ( res ) {
            done();
          });
          break;
        case 'uninstall':
          ngbp.plugins.uninstall( arg2, function () {
            done();
          });
          break;
        default:
          grunt.fail.fatal( "Unknown ngbp:plugins action: " + cmd );
          break;
      }
    }
  }

  /********************************************************************************/

  /**
   * Merge the default ngbp config into the grunt config so other tasks can access it.
   */
  options = MERGE( ngbp.config.default, grunt.config.getRaw( 'ngbp' ) || {} );
  grunt.config.set( 'ngbp', options );

  /**
   * Now load all installed modules. We have to do this before any other tasks run so that tasks
   * spawned to new grunt instances will have the requisite tasks defined. But this is a safe
   * operation as any modules not yet installed will not be loaded until an appropriate ngbp task is
   * executed.
   */
  modules = ngbp.plugins.getModules();
  ngbp.plugins.loadModules( modules );

  /** 
   * This is the actual ngbp task.
   */
  grunt.registerTask( 'ngbp', function ( cmd, arg2, arg3 ) {
    if ( ! cmd || cmd === '' ) {
      grunt.log.writeln( "No task specified; running build and compile." );
      build.call( this );
      compile.call( this );
    } else {
      switch ( cmd ) {
        case 'build':
          build.call( this );
          break;
        case 'watch':
          watch.call( this );
          break;
        case 'compile':
          compile.call( this );
          break;
        case 'globs':
          globs.call( this, arg2 );
          break;
        case 'tasks':
          tasks.call( this, arg2 );
          break;
        case 'bower':
          bower.call( this, arg2, arg3 );
          break;
        case 'plugins':
          plugins.call( this, arg2, arg3 );
          break;
        default:
          grunt.fail.fatal( "Unknown ngbp task: " + cmd );
          break;
      }
    }
  });
};

