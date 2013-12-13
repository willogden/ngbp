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
    source_assets_dir: 'src/assets',
    build_dir: 'build/',
    compile_dir: 'bin/',
    build_assets_dir: '<%= ngbp.build_dir %>/assets',
    build_js_dir: '<%= ngbp.build_dir %>/js',
    build_css_dir: '<%= ngbp.build_dir %>/css',
    globs: {
      app: {
        js: [ 'src/**/*.js', '!src/**/*.spec.js', '!src/assets/**/*.js' ],
        jsunit: [ 'src/**/*.spec.js' ],
        html: [ 'src/app/**/*.tpl.html', 'src/common/**/*.tpl.html' ],
        css: [ 'src/styles/**/*.css' ],
        assets: [ 'src/assets/**/*' ]
      }
    }
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

  /**
   * Prints out the list of defined globs.
   */
  function globs ( prop ) {
    var done = this.async();

    loadModules( function () {
      var val;
      var key = 'ngbp.globs';

      // TODO: mix in task-defined globs
      
      if ( prop ) {
        key += '.' + prop;
      }

      val = grunt.config.get( key );
      
      if ( val instanceof Array ) {
        grunt.log.writeln( key + "[]: " + grunt.log.wordlist( val ) );
      } else if ( val instanceof Object ) {
        grunt.log.writeln( "Keys in " + key + ": " + grunt.log.wordlist( Object.keys( val ) ) );
      } else {
        grunt.log.write( key + ": " + val.cyan );
      }

      done();
    });
  };

  /**
   * Prints out the set of hooked tasks.
   */
  function tasks ( subset ) {
    var done = this.async();

    loadModules( function () {
      var hooks = ngbp.task.getHooks();

      // TODO: mix in hooks from grunt config
      // TODO: mark tasks as ignored if ignored in grunt config
      // TODO: print watches too
      
      function printTasks ( name, tasks, indent ) {
        grunt.log.writeln( "\n" + name.blue );
        if ( tasks ) {
          tasks.forEach( function ( task ) {
            grunt.log.writeln( indent + task.priority + " - " + task.task );
          });
        } 
      }

      grunt.log.subhead( "Enabled tasks:".magenta );

      if ( subset ) {
        if ( hooks[ subset ] ) {
          printTasks( subset, hooks[ subset ], " " );
        } else {
          grunt.fail.warn( "Unknown hook: " + subset );
        }
      } else {
        for ( key in hooks ) {
          printTasks( key, hooks[ key ], "  " );
        };
      }

      done();
    });
  };

  /**
   * Perform the prebuild, build, and postbuild tasks according to the priority
   * with which they registered.
   */
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

      grunt.log.writeln("copy config:");
      grunt.log.writeflags(grunt.config.get('ngbp'));

      done();
    });
  };

  /********************************************************************************/


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
