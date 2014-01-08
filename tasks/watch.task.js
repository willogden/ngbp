var NGBP = require( './../lib/ngbp' );
var MOUT = require( 'mout' );

/**
 * The NGBP Grunt task definition.
 */
module.exports = function ( GRUNT ) {
  /**
   * Prepares and then runs the watch command.
   */
  GRUNT.registerTask( 'ngbp-watch', function () {
    var done = this.async();
    var watchConfig = {};
    var watches, globKey, patterns;

    NGBP.task.prepareTaskList().then( function () {
      watches = NGBP.task.getWatches();

      for ( key in watches ) {
        // Get the glob key from the slugified version and then fetch the file patterns.
        globKey = MOUT.string.unCamelCase( key, '.' );
        patterns = GRUNT.config.getRaw( 'ngbp.globs.' + globKey );

        // These are the tasks that need to be run for this glob.
        var tasks = [];
        watches[ key ].forEach( function ( task ) {
          tasks.push( task.taskName );
        });

        // Create a new watch config entry for it.
        watchConfig[ key ] = {
          files: patterns,
          tasks: tasks
        };
      };

      // Load the config into Grunt; we just overwrite it as merging would not make a lot of sense.
      GRUNT.loadNpmTasks( 'grunt-contrib-watch' );
      GRUNT.task.renameTask( 'watch', 'delta' );
      GRUNT.config.set( 'delta', watchConfig );

      // Finally, run the task.
      GRUNT.task.run( 'delta' );
      
      done();
    });
  });
};

