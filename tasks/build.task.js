var NGBP = require( './../lib/ngbp' );
var MOUT = require( 'mout' );

/**
 * The NGBP Grunt task definition.
 */
module.exports = function ( GRUNT ) {
  /**
   * Perform the prebuild, build, and postbuild tasks according to the priority
   * with which they registered.
   */
  GRUNT.registerTask( 'ngbp-build', function () {
    var done = this.async();

    NGBP.task.prepareTaskList()
    .then( function () {
      var build_steps = [ 'prebuild', 'build', 'postbuild' ];
      var hooks = NGBP.task.getHooks();

      build_steps.forEach( function forEachBuildStep ( step ) {
        NGBP.task.queueTasks( hooks[ step ].map( function ( t ) { return t.taskName; } ) );
      });

      done();
    }).catch( NGBP.log.fatal );
  });
};

