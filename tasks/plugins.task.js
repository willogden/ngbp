var NGBP = require( './../lib/ngbp' );

/**
 * The NGBP Grunt task definition.
 */
module.exports = function ( GRUNT ) {
  /**
   * Manage ngbp plugins through NPM
   */
  GRUNT.registerTask( 'ngbp-plugins', function ( cmd, arg2 ) {
    var done = this.async();

    // print a list of installed tasks if requested...or if no command was supplied
    if ( ! cmd || cmd === '' || cmd === 'list' ) {
      GRUNT.log.writeln( "Current Modules".magenta );
      modules.forEach( function ( mod ) {
        GRUNT.log.writeln( mod + ( ! NGBP.plugins.isInstalled( mod ) ? ' (not installed)' : '' ) );
      });

      done();
    } else {
      switch ( cmd ) {
        case 'search':
          NGBP.plugins.search( arg2, function () {
            done();
          });
          break;
        case 'install':
          NGBP.plugins.install( arg2, function ( res ) {
            done();
          });
          break;
        case 'uninstall':
          NGBP.plugins.uninstall( arg2, function () {
            done();
          });
          break;
        default:
          GRUNT.fail.fatal( "Unknown ngbp:plugins action: " + cmd );
          break;
      }
    }
  });
};

