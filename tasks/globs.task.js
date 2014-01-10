var NGBP = require( './../lib/ngbp' );
var MOUT = require( 'mout' );

/**
 * The NGBP Grunt task definition.
 */
module.exports = function ( GRUNT ) {
  /**
   * Prints out the list of defined globs.
   */
  GRUNT.registerTask( 'ngbp-globs', function () {
    var done = this.async();

    NGBP.task.prepareTaskList().then( function () {
      var val;
      var key = 'ngbp.globs';

      if ( GRUNT.option( 'raw' ) ) {
        val = JSON.stringify( GRUNT.config.getRaw( key ), {}, "  " );
      } else {
        val = JSON.stringify( GRUNT.config.get( key ), {}, "  " );
      }

      GRUNT.log.writeln( "Globs:".magenta );
      GRUNT.log.writeln( val );

      done();
    }).catch( NGBP.log.fatal );
  });
};


