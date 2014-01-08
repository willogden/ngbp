var NGBP = require( './../lib/ngbp' );

/**
 * The NGBP Grunt task definition.
 */
module.exports = function ( GRUNT ) {
  /**
   * Runs bower tasks.
   */
  GRUNT.registerTask( 'ngbp-bower', function ( cmd, pkg ) {
    var done = this.async();
    NGBP.bower.run( cmd, pkg ).then( function () {
      done();
    });
  });
};

