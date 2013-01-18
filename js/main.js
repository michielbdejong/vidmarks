require.config( {
  paths: {
    //jquery: ['http://ajax.googleapis.com/ajax/libs/jquery/1.7.2/jquery.min', 'lib/jquery.min'],
    jsuri: 'vendor/jsuri-1.1.1.min',
    rs: 'vendor/remoteStorage/src',
    module_videos: 'js/rs_modules/videos',
    module_globaltags: 'js/rs_modules/global_tags'
  },
  baseUrl: '/'
});

require(['js/vidmarks'], function(vidmarks) {
  vidmarks.init();
});

console.log(this);