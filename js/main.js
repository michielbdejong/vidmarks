if(!net) var net={};
if(!net.silverbucket) net.silverbucket={};
if(!net.silverbucket.vidmarks) net.silverbucket.vidmarks={};

/**
 * navMenu - little helper utility to handle navigation tasks
 *
 * requires: jQuery
 */
net.silverbucket.vidmarks.navMenu = function() {
    var pub = {};
    var _ = {};

    pub.init = function(pages) {
        _.pages = pages;
    };

    pub.toggle = function(page) {
        console.log('navMenu - click received');
        var num_pages = _.pages.length;
        for ( var i = 0; i < num_pages; i++ ) {
            if ( _.pages[i] != page ) {
                $("a#link-"+_.pages[i]).removeClass('selected');
                $("section#"+_.pages[i]).hide();
            }
        }
        // fade in page content
        $("section#"+page+"").fadeIn('fast');
        $("a#link-"+page+"").addClass('selected');
    };

    return pub;
}();


/**
 * dbModel - provides an abraction for the various remoteStorage.js modules required.
 *
 * requires: remoteStorage.js
 */
net.silverbucket.vidmarks.dbModel = function() {
    var pub = {}; // public variable and functions container
    var _ = {}; // private variable and functions container

    _.modules = {}; // module objects for RS
    _.app_namespace = 'vidmarks';
    _.doc_type = 'videos';
    _.cache = {};

    pub.init = function() {
        console.log('- DB: init()');
        remoteStorage.claimAccess('videos', 'rw');
        remoteStorage.claimAccess('tags', 'rw');
        remoteStorage.displayWidget('remotestorage-connect'); // after that (not before that) display widget

        _.modules.videos    = remoteStorage.videos;
        _.modules.tags      = remoteStorage.tags;
        _.modules.tags.docType = 'videos';

        // testing events, changing, behavior
        _.modules.videos.on('error', function(err) {
            console.log('DB ERROR: videos - '+err);
        });

        // XXX - this function returns only obj, not id [original params were (id, obj)]
        _.modules.videos.on('change', function(obj) {
            console.log('DB CHANGE: videos on(change) fired.');
            console.log(obj);
        });

        _.modules.tags.on('error', function(err) {
            console.log('DB ERROR: tags - '+err);
        });

        // XXX - this function returns only obj, not id [original params were (id, obj)]
        _.modules.tags.on('change', function(obj) {
            console.log('DB CHANGE: tags on(change) fired.');
            console.log(obj);
        });
    };

    pub.onAction = function(action, func) {
        _.modules.videos.on(action, function(obj) {
            func(obj);
        });
    };

    // set a temp cache of video details, used for saving in the addVidmark function
    pub.setCache = function(category, details) {
        console.log('setCache('+category+')', details);
        _.cache[category] = details;
    };

    pub.getCache = function(category) {
        var results = [];
        if (_.cache[category]) {
            results = _.cache[category];
        }
        return results;
    };

    pub.getTags = function() {
        return _.modules.tags.getTags();
    };

    pub.getTagCounts = function() {
        var tags = pub.getTags();
        var num_tags = tags.length;
        var r_struct = {};
        for (var i = 0; i < num_tags; i++) {
            var tag_recs = _.modules.tags.getTagged(tags[i]);
            r_struct[tags[i]] = tag_recs.length;
        }
        return r_struct;
    };

    pub.getTagsByRecord = function(recordId) {
        var tags = _.modules.tags.getTagsByRecord(recordId);
        console.log('DB getTagsByRecord -- ', tags);
        return tags;
    };

    pub.addTagsToRecord = function(recordId, tagNames, completedFunc) {
        _.modules.tags.addTagsToRecord(recordId, tagNames);
        completedFunc();
    };

    pub.addVidmark = function(vidmark_id) {
        if (!_.cache) {
            console.log('CACHE not set, cannot save');
            return false;
        }
        var details = pub.getCache('video');
        var tags = pub.getCache('tags');
        //console.log(details);
        var cache_id = details['source']+'_'+details['vid_id'];
        if (vidmark_id === cache_id) {
            console.log('ID match! we can save');
            _.modules.videos.add(details, cache_id);
            _.modules.tags.addTagsToRecord(cache_id, tags);
        } else {
            console.log('IDs do not match ['+vidmark_id+' = '+cache_id+']');
        }
        //var new_id = _.modules.bookmarks.add(url, title, description);
        //return new_id;
    };

    pub.getAll = function() {
        console.log('- DB: getAll()');
        var ids = _.modules.videos.getIds();
        var all = {};
        var num_ids = ids.length;
        for (var i = 0; i < num_ids; i++) {
            var obj = _.modules.videos.get(ids[i]);
            all[ids[i]] = obj;
        }
        return all;
    };

    pub.getById = function(id) {
        return _.modules.videos.get();
    };

    pub.deleteAll = function() {
        console.log('- DB: deleteAll()');
        var ids = _.modules.videos.getIds();
        console.log(ids);
        var all = {};
        var num_ids = ids.length;
        for (var i = 0; i < num_ids; i++) {
            _.modules.videos.remove(ids[i]);
        }
        return all;
    };

    return pub;
}();


/**
 * appLogic - generic app related methods and logic
 *
 * requires: jQuery
 */
net.silverbucket.vidmarks.appLogic = function() {
    var pub = {};
    var _ = {};

    pub.init = function() {
        _.util = net.silverbucket.vidmarks.utilityFunctions;
        _.nav = net.silverbucket.vidmarks.navMenu;
        _.nav.init(['list']);//, 'submit']);
        _.nav.toggle('list');
        _.vidAPI = net.silverbucket.videoSiteAPI;
        _.db = net.silverbucket.vidmarks.dbModel;
        _.db.init();

        _.db.onAction('change', function(event) {
            console.log('DB.onAction EVENT: ', event);
            if(event.newValue && event.oldValue) {
                //updateBookmarkRow(event.path, event.newValue);
            } else if(event.newValue) {
                //addBookmarkRow(event.path, event.newValue);
            } else {
                //deleteBookmarkRow(event.path);
            }
        });

        /*
         * navigation
         */
        $("a#link-submit").click(function() {
            _.nav.toggle('submit');
            return false;
        });

        $("a#link-list").click(function() {
            _.nav.toggle('list');

            pub.displayVidmarkList();

            return false;
        });
        /* */

        /*
         * form controls
         */
        $("input#input_vid_url").bind('paste', function(event) {
            var _this = this;
            // Short pause to wait for paste to complete
            setTimeout( function() {
                var url = $(_this).val();
                if (!_.vidAPI.retrieveDetails(url, pub.displayNewVidmark, pub.displayErrorVidmark)) {
                    pub.displayMessage(_.vidAPI.getErrorMessage(), 'error');
                }
            }, 100);
        });

        $("form#submit_url_form").validate({
            //set the rules for the field names
            rules: {
                vid_url: {
                    minlength: 4,
                    url: true
                }
            },
            //set messages to appear inline
            messages: {
                vid_url: ""
            },
            submitHandler: function(form) {
                console.log('form submittion passed validation');
                var url = $('#input_vid_url').val();
                _.db.addVidmark(url);
                $('#input_vid_url').val('');
                return false;
            }
        });

        // when you hit enter in the tag input field, we save the new tags
        // using the jquery 'delegate' function ('on')
        $("section#vidmarks").on('keypress', 'input.tag_list', function (e) {
            if (e.which == 13) {
                console.log(e);
                var id = $(this).parent().parent().attr('id');
                console.log('ENTER was pressed tag field ['+id+']');
                var tag_list = _.getInputTags(id);
                console.log(tag_list);
                _.db.addTagsToRecord(id, tag_list, function(){_.updateTagStatus(id, 'tags updated!');});
                pub.displayTagList(); // update tags list
                e.preventDefault();
                return false;
            }
        });
        /* */

        pub.displayTagList();
        pub.displayVidmarkList();
    };

    /*******************************/

    _.vidmarks = {};
    _.templates = {};


    // title, visit_url, visit_url (readable), description, thumbnail
    _.templates.display_vidmark = '<div class="video_details"><h1>{0}</h1>'+
                '<a target="_blank" href="{2}">{3}</a>'+
                '<div class="description"><h3>description</h3><p class="description">{4}</p></div></div>'+
                '<div class="video_embed"><img src="{5}" alt="thumbnail"/></div>'+
                '<div class="tags"><label name="tag_label" class="tag_label">tags</label>'+
                '<input class="tag_list" type="text" size="50" name="tags" value="{6}"/>'+
                '<div class="tags_status"></div></div>';

    /*******************************/

    /*
     * present new vidmark data for submition
     */
    pub.displayNewVidmark = function(details) {
        var record_id = details['source']+'_'+details['vid_id'];
        var tags = [' ']; // new entries wont have any tags
        console.log('displayNewVidmark - vid_id:'+record_id, details);

        if (_.vidmarks[record_id]) {
            pub.displayMessage('that video already exists!', 'info');
            //pub.scrollToEntry(record_id);
            return false;
        }

        _.db.setCache('video', details); // cache the details in case of save

        $("#vidmarks").prepend('<article id="'+record_id+'" class="new_vidmark vidmark">'+
                    '<div id="save_status"><a href="#add" class="button stretch" id="add-vidmark">add video</a></div>'+
                    _.string_inject(_.templates.display_vidmark,
                            [details['title'], details['visit_url'], details['visit_url'],
                            details['description'], details['thumbnail'], tags])+
                    '</article>'
                );

        // add listener for save call
        $("a#add-vidmark").click(function() {
            var vidmark_id = $(this).parent().parent().attr('id');
            console.log('vidmark_id['+vidmark_id+']');
            $('#save_status').html('<p class="status">saving video</p>');
            _.db.addVidmark(vidmark_id);
            $('#save_status').html('<p class="success">video saved! view <a href="#videos" id="quicklink-list">video list</a></p>');
            $(this).parent().parent().addClass('saved');
            $("a#quicklink-list").click(function() {
                _.nav.toggle('list');
                pub.displayVidmarkList();
                return false;
            });

            return false;
        });

        // when you hit enter in the tag input field, we save the new tags
        $("article#"+record_id+' input.tag_list').keypress(function (e) {
            if (e.which == 13) {
                console.log('ENTER was pressed tag field');
                var tag_list = _.getInputTags(record_id);
                _.db.setCache('tags', tag_list);
                _.updateTagStatus(record_id, 'tags will be saved along with video');
                e.preventDefault();
                return false;
            }
        });
    };

    /*
     * display existing vidmark entries
     */
    pub.displayVidmarkList = function() {
        console.log('displayVidmarkList()');
        var list = _.db.getAll();
        //console.log(list);
        $("#vidmarks").html('');

        _.vidmarks = list;
        for (var id in list) {
            console.log('processing ['+id+']');
            var tags = _.db.getTagsByRecord(id);
            var tags_formatted = _.formatTagList(tags);
            $("#vidmarks").append(
                    '<article id="'+id+'" class="vidmark">'+
                    _.string_inject(_.templates.display_vidmark,
                            [list[id]['title'], list[id]['visit_url'], list[id]['visit_url'],
                            list[id]['description'], list[id]['thumbnail'], tags_formatted])+
                    '</article>');
            //console.log('END ['+id+']');
        }
    };

    /*
     * display tags and their counts in the aside bar
     */
    pub.displayTagList = function() {
        console.log('displayTagList()');
        var list = _.db.getTagCounts();
        console.log('displayTagList()  - return value:');
        console.log(list);
        $("aside ul#full_tag_list").html('');

        for (var tag in list) {
            //console.log('processing ['+tag+']');
            //console.log('appending: <li id="'+tag+'">'+tag+' ('+list[tag]+')</li>');
            $('aside ul#full_tag_list').append('<li>'+tag+'</li> ('+list[tag]+')<br />');
            //console.log('END ['+id+']');
        }
    };

    pub.displayErrorVidmark = function() {
        console.log('errorVidmark called!');
    };

    pub.scrolToEntry = function(id) {
        $('#vidmarks').animate({scrollTop: $("#"+id).offset().top},'slow');
    };

    pub.displayMessage = function(message, type) {
        console.log('displayMessage('+message+')');
        if (!type) { type = 'info'; }
        $('#message').html('<p class="'+type+'">'+message+'</p>');
        $('#message p').delay(1000).fadeOut('slow');
    };

    _.updateTagStatus = function(id, message) {
        $('article#'+id+' div.tags_status').html(message);
    };
    _.getInputTags = function(id) {
        var tag_list = $('article#'+id+' input.tag_list').val().replace(/\s+/g, '').split(/\,\s*/);
        console.log(tag_list);
        return tag_list;
    };
    _.formatTagList = function(tags) {
        if (tags.length === 0) {
            tags.push(' ');
        }
        return tags.join(', ');
    };

    /*
     * basic templating function, stolen from:
     * http://mattsnider.com/template-string-replacement-function/
     */
    _.string_inject = function(sSource, aValues) {
        var i = 0;
        if (aValues && aValues.length) {
            return sSource.replace(/\{\d+\}/g, function(substr) {
                    var sValue = aValues[i];
                    if (sValue) {
                        i += 1;
                        return sValue;
                    } else {
                        return substr;
                    }
                });
        }
        return sSource;
    };

    return pub;
}();





$(document).ready(function() {
    var app = net.silverbucket.vidmarks.appLogic;
    app.init();
});