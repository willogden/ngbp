var NGBP = require( './../lib/ngbp' );
var MOUT = require( 'mout' );

/**
 * The NGBP Grunt task definition.
 */
module.exports = function ( GRUNT ) {
  /**
   * Perform the precompile, compile, and postcompile tasks according to the priority
   * with which they registered.
   */
  GRUNT.registerTask( 'ngbp-compile', function () {
    var done = this.async();

    NGBP.task.prepareTaskList()
    .then( function () {
      var compile_steps = [ 'precompile', 'compile', 'postcompile' ];
      var hooks = NGBP.task.getHooks();

      compile_steps.forEach( function forEachBuildStep ( step ) {
        NGBP.task.queueTasks( hooks[ step ].map( function ( t ) { return t.taskName; } ) );
      });

      done();
    }).catch( NGBP.log.fatal );
  });
};

