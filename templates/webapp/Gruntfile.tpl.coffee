module.exports = ( grunt ) ->
  grunt.config.init
    pkg: grunt.file.readJSON( "./package.json" )
    ngbp: grunt.file.readJSON( "./ngbp.json" )

  # Load ngbp
  grunt.loadNpmTasks "ngbp"

