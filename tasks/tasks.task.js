var NGBP = require( './../lib/ngbp' );
var MOUT = require( 'mout' );

/**
 * The NGBP Grunt task definition.
 */
module.exports = function ( GRUNT ) {
  /**
   * Prints out the list of defined globs.
   */
  GRUNT.registerTask( 'ngbp-tasks', function ( subset ) {
    /**
     * Prints out the set of hooked tasks.
     */
    var done = this.async();

    NGBP.task.prepareTaskList().then( function () {
      var hooks = NGBP.task.getHooks();
      var watches = NGBP.task.getWatches();
      var ignore, globKey;

      function printTasks ( name, tasks, indent ) {
        GRUNT.log.writeln( "\n" + name.blue );
        if ( tasks ) {
          tasks.forEach( function ( task ) {
            ignore = NGBP.task.shouldPreventTask( task.taskName ) ? ' (prevented)' : '';
            GRUNT.log.writeln( indent + task.priority + " - " + task.taskName + ignore.yellow );
          });

          if ( ! tasks.length ) {
            GRUNT.log.writeln( indent + "(none)" );
          }
        } 
      }

      if ( subset && subset !== 'watch' ) {
        GRUNT.log.subhead( "Tasks:".magenta );

        if ( hooks[ subset ] ) {
          printTasks( subset, hooks[ subset ], " " );
        } else {
          GRUNT.fail.warn( "Unknown hook: " + subset );
        }
      } else if ( ! subset ) {
        GRUNT.log.subhead( "Tasks:".magenta );

        for ( key in hooks ) {
          printTasks( key, hooks[ key ], "  " );
        };
      }

      if ( ! subset || subset == 'watch' ) {
        GRUNT.log.subhead( "Watches:".magenta );

        Object.keys( watches ).sort().forEach( function ( key ) {
          globKey = MOUT.string.unCamelCase( key, '.' );
          glob = GRUNT.option( 'raw' ) ? GRUNT.config.getRaw( "ngbp.globs." + globKey )
            : GRUNT.config.get( "ngbp.globs." + globKey );
          printTasks( globKey + ": " + glob, watches[ key ], "  " );
        });
      }

      done();
    }).catch( NGBP.log.fatal );
  });
};


