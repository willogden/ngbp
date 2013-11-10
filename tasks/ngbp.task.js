var ngbp = require( '../index' );
var merge = require( 'deepmerge' );
var path = require( 'path' );
var async = require( 'async' );

/**
 * The NGBP Grunt task definition.
 */
module.exports = function ( grunt ) {
  /**
   * The merged options from the defaults and from the user's Grunt config.
   */
  var options;

  /**
   * Default ngbp options
   */
  var defaultOptions = {
    build_dir: 'build/',
    compile_dir: 'bin/'
  };

  function getModules () {
    var pkg = grunt.config.get( 'pkg' );

    if ( ! pkg ) {
      grunt.fail.fatal( "ngbp requires a `pkg` variable in your Grunt config." );
      return;
    }

    if ( ! pkg.ngbpModules || ! pkg.ngbpModules.length instanceof Array ) {
      grunt.fail.fatal( 'ngbp requires an `ngbpModules` array in your `package.json`.' );
      return;
    }

    return pkg.ngbpModules;
  };

  function moduleIsInstalled ( name ) {
    if ( grunt.file.exists( path.join( path.resolve( 'node_modules' ), name, 'tasks' ) ) ) {
      return true;
    } else {
      return false;
    }
  }

  function loadModules ( callback ) {
    var modules = getModules();

    // Ensure we have all modules installed
    async.eachSeries( modules, function forEachModule ( mod, cb ) {
      if ( ! moduleIsInstalled( mod ) ) {
        grunt.log.subhead( ( "Installing " + mod + "..." ).blue );
        grunt.util.spawn({
          cmd: 'npm',
          args: [ 'install', '--save-dev', '../'+mod ]
          // TODO: replace with NPM version
          //args: [ 'install', '--save-dev', mod ]
        }, function ( err ) {
          if ( err ) {
            grunt.fail.fatal( "Could not install " + mod + ": " + err.toString() );
          }
          grunt.loadNpmTasks( mod );
          cb();
        });
      } else {
        grunt.loadNpmTasks( mod );
        cb();
      }
    }, function () {
      callback();
    });
  }

  globs = function globs ( grunt ) {
    grunt.log.writeln("Globs...");
  };

  /**
   * Prints out the set of hooked tasks.
   */
  tasks = function tasks () {
    var done = this.async();

    loadModules( function () {
      var hooks = ngbp.task.getHooks();

      // TODO: mix in hooks from grunt config
      // TODO: mark tasks as ignored if ignored in grunt config
      // TODO: print watches too
      // TODO: allow printing subsets of of the build
      
      function printTasks ( tasks, indent ) {
        if ( tasks ) {
          tasks.forEach( function ( task ) {
            grunt.log.writeln( indent + task.priority + " - " + task.task );
          });
        } 
      }

      grunt.log.subhead( "Enabled tasks:".magenta );
      for ( key in hooks ) {
        grunt.log.writeln( "\n" + key.blue );
        printTasks( hooks[ key ], "  " );
      };

      done();
    });
  };

  build = function build () {
    var done = this.async();

    loadModules( function () {
      var build_steps = [ 'prebuild', 'build', 'postbuild' ];
      var hooks = ngbp.task.getHooks();

      build_steps.forEach( function forEachBuildStep ( step ) {
        hooks[ step ].forEach( function forEachTask ( task ) {
          grunt.task.run( task.task );
        });
      });

      done();
    });
  };


  /** 
   * Task definitions
   */
  grunt.registerTask( 'ngbp', function ( cmd, arg2 ) {
    options = merge( defaultOptions, grunt.config.getRaw( 'ngbp' ) || {} );
    grunt.config.set( 'ngbp', options );

    switch ( cmd ) {
      case 'build':
        build.call( this );
        break;
      case 'globs':
        globs.call( this, arg2 );
        break;
      case 'tasks':
        tasks.call( this, arg2 );
        break;
      default:
        grunt.fail.fatal( "Unknown ngbp task: " + cmd );
        break;
    }
  });
};
