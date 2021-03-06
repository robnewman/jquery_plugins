/**
 * RecentEarthquakesGoogleMap 1.0 - Display earthquakes on a Google Map
 *
 * @version   1.0
 * @requires  jQuery v1.7.1
 * @requires  jQueryUI v1.8.18
 * @requires  GoogleMapsAPI v3
 * @requires  MarkerWithLabel for v3
 * @copyright (c) 2012 Rob Newman <robertlnewman@gmail.com> 858.822.1333
 * @license   MIT and GPL licenses:
 *            http://www.opensource.org/licenses/mit-license.php
 *            http://www.gnu.org/licenses/gpl.html
 */
/**
 * @example   $('div.map').recentEarthquakesGoogleMap();
 * @desc      Create a simple Google using defaults
 *
 * @option    String markersdir Directory containing marker images
 * @option    String faultSettings (optional) Directory containing fault zone geometries and all fault settings
 * @type      jQuery
 * @name      recentEarthquakesGoogleMap
 * @cat       Plugins/RecentEarthquakesGoogleMap
 * @author    Rob Newman <robertlnewman@gmail.com> 858.822.1333
 * @notes     Google Maps Control Position class locations:
              +----------------+
              + TL    TC    TR +
              + LT          RT +
              +                +
              + LC          RC +
              +                +
              + LB          RB +
              + BL    BC    BR +
              +----------------+
 */

(function($) {

    $.fn.recentEarthquakesGoogleMap = function(options) {
        debug(this);
        var recenteqsOpts = $.extend({},
                                     $.fn.recentEarthquakesGoogleMap.defaults,
                                     options);
        // Use get(0) to access DOM node (http://api.jquery.com/get/)
        var recenteqsMapDiv = this.get(0);
        /* Create a data holder
         * to maintain state
         * and/or check values
         */
        $(recenteqsMapDiv).data('recenteqs', {
            'preserve_state': false,
            'refresh_rate': false,
            'refresh_var': false,
            'location': [],
            'zoom': recenteqsOpts.initZoom,
            'faults': recenteqsOpts.faults,
            'cookieId': recenteqsOpts.cookieId,
            'polylines': []
        });
        $.fn.recentEarthquakesGoogleMap.getCookie(recenteqsMapDiv);
        $.fn.recentEarthquakesGoogleMap.init(recenteqsMapDiv, recenteqsOpts);
    };

    $.fn.recentEarthquakesGoogleMap.init = function(mapDiv, opts) {
        /* Init the Google map */
        /* {{{ */
        var lat=opts.defaultLocation[0], lng=opts.defaultLocation[1];
        if(($(mapDiv).data('recenteqs').location).length == 2) {
            lat = $(mapDiv).data('recenteqs').location[0];
            lng = $(mapDiv).data('recenteqs').location[1]; 
        }
        var zoom = opts.initZoom;
        if(($(mapDiv).data('recenteqs').zoom) != 0) {
            zoom = parseInt($(mapDiv).data('recenteqs').zoom, 10);
        }
        var mapOptions = {
            zoom: zoom,
            maxZoom: opts.maxZoom,
            scaleControl: true,
            center: new google.maps.LatLng(lat, lng),
            mapTypeControl: true,
            mapTypeControlOptions: { style:google.maps.MapTypeControlStyle.DROPDOWN_MENU },
            zoomControl: true,
            zoomControlOptions: { style:google.maps.ZoomControlStyle.SMALL },
            mapTypeId: google.maps.MapTypeId.TERRAIN
        };
        var map = new google.maps.Map(mapDiv, mapOptions);
        var metaDiv = $.fn.recentEarthquakesGoogleMap.addMetadata(map);
        $.fn.recentEarthquakesGoogleMap.faultLegend(map, mapDiv, opts.faultSettings);
        $.fn.recentEarthquakesGoogleMap.addRefresher(map, mapDiv, metaDiv, opts);
        $.fn.recentEarthquakesGoogleMap.addEvents(map, mapDiv, metaDiv, opts);
        $.fn.recentEarthquakesGoogleMap.addStations(map, opts);
        /* }}} */
    }

    $.fn.recentEarthquakesGoogleMap.destroy = function() {
        /* Unbind namespace */
        /* {{{ */
        return this.each(function() {
            $(window).unbind('.recenteqs');
        })
        /* }}} */
    }

    $.fn.recentEarthquakesGoogleMap.rounder = function(val, dp) {
        /* Utility function for rounding */
        /* {{{ */
        return parseFloat(Math.round(val*Math.pow(10, dp))/Math.pow(10, dp));
        /* }}} */
    }

    $.fn.recentEarthquakesGoogleMap.faultLegend = function(map, mapDiv, faultSettings) {
        /* Build the fault legend
         * and load any faults
         */
        /* {{{ */
        var faultLegend = document.createElement('DIV');
        faultLegend.id = 'faultLegend';
        faultLegend.className = 'mapoverlay';

        $('<p><span class="ui-icon ui-icon-arrow-4"></span>Fault Legend</p>').appendTo($(faultLegend));
        $('#faultContent').clone().show().appendTo($(faultLegend)).accordion({autoHeight:false, navigation:true});

        if($(mapDiv).data('recenteqs').faults.length > 0) {
            $.each($(mapDiv).data('recenteqs').faults, function(key, value) {
                $(faultLegend).find('input[id='+value+']').attr('checked', 'checked');
                $.fn.recentEarthquakesGoogleMap.loadFault(map, mapDiv, value, faultSettings);
            });
        }

        // Register click event
        $(faultLegend).find('input').click(function() {
            if($(this).is(':checked')) {
                $.fn.recentEarthquakesGoogleMap.loadFault(map, mapDiv, this.id, faultSettings);
            } else {
                $.fn.recentEarthquakesGoogleMap.unloadFault(map, mapDiv, this.id, faultSettings);
            }
        });

        $(faultLegend).draggable();
        map.controls[google.maps.ControlPosition.LEFT_BOTTOM].push(faultLegend);
        /* }}} */
    }

    $.fn.recentEarthquakesGoogleMap.eventLegend = function(map) {
        /* Build the event legend */
        /* {{{ */
        var eventLegend = document.createElement('DIV');
        eventLegend.id = 'evLabel';
        eventLegend.className = 'mapoverlay';
        $('#evContent').clone(true).show().appendTo($(eventLegend));
        $(eventLegend).draggable({containment:'#googlemap', cursor:'move'});
        map.controls[google.maps.ControlPosition.RIGHT_BOTTOM].push(eventLegend);
        /* }}} */
    }

    $.fn.recentEarthquakesGoogleMap.getCookie = function(mapDiv) {
        /* Get the cookie vals
         * and attach to the map
         * div as a data() obj
         */
        /* {{{ */
        var cookies = document.cookie.split(';');
        $.each(cookies, function(key, val) {
             // There is more than one cookie for this domain
             if(val.indexOf($(mapDiv).data('recenteqs').cookieId) >= 0) {
                 // Need to remove the cookieId prefix
                 var fullCookie = val.split('=');
                 var cookieSplit = fullCookie[1].split('|');
                 $.each(cookieSplit, function(cKey, cVal) {
                     var crumbSplit = cVal.split(':');
                     if(crumbSplit[0] == 'refresh_rate') {
                         if(crumbSplit[1] !== undefined && crumbSplit[1] !== 'false') {
                             $(mapDiv).data('recenteqs').refresh_rate = crumbSplit[1];
                         }
                     } else if(crumbSplit[0] == 'zoom') {
                         if(crumbSplit[1] !== undefined) {
                             $(mapDiv).data('recenteqs').zoom = crumbSplit[1];
                         }
                     } else if(crumbSplit[0] == 'preserve_state') {
                         if(crumbSplit[1] !== undefined && crumbSplit[1] !== 'false') {
                             $(mapDiv).data('recenteqs').preserve_state = crumbSplit[1];
                         }
                     } else if(crumbSplit[0] == 'location') {
                         if(crumbSplit[1] !== undefined) {
                             var locArr = crumbSplit[1].split(',');
                             $(mapDiv).data('recenteqs').location = locArr;
                         }
                     } else if(crumbSplit[0] == 'faults') {
                         if(crumbSplit[1] !== undefined) {
                             var faultArr = crumbSplit[1].split(',');
                             $(mapDiv).data('recenteqs').faults = faultArr;
                         }
                     }
                 });
             }
        });
        /* }}} */
    }

    $.fn.recentEarthquakesGoogleMap.setCookie = function(map, mapDiv) {
        /* Set cookie */
        /* {{{ */
        var alertString = [
            'Your browser is set to not accept cookies. ',
            'Please modify your browser settings.'
        ].join('');
        // Define times
        var nowPreserve = new Date();
        var oneYear = 365*24*60*60*1000; // one year in milliseconds
        var thenPreserve = nowPreserve.getTime() + oneYear;
        nowPreserve.setTime(thenPreserve);
        var utcexpiryPreserve = nowPreserve.toUTCString();

        /* Create cookie string
         * Some values should be
         * treated like arrays, even
         * though they are strings
         */
        var cookieStr = '';
        var cookieIgnore = ['cookieId', 'polylines'];
        $.each($(mapDiv).data('recenteqs'), function(cKey, cVal) {
            if($.inArray(cKey, cookieIgnore) == -1 ) {
                if(cKey == 'location') {
                    var lat = map.getCenter().lat(), lng = map.getCenter().lng();
                    var locArr = [
                        cKey,
                        ':',
                        $.fn.recentEarthquakesGoogleMap.rounder(lat, 4),
                        ',',
                        $.fn.recentEarthquakesGoogleMap.rounder(lng, 4),
                        '|'].join('');
                    cookieStr += locArr;
                } else if(cKey == 'zoom') {
                    var zoom = map.getZoom();
                    cookieStr += cKey+':'+zoom+'|';
                } else if(cKey == 'faults') {
                    cookieStr += cKey+':';
                    $.each(cVal, function() {
                        cookieStr += this+',';
                    });
                    cookieStr = cookieStr.substr(0,cookieStr.length-1);
                    cookieStr += '|';
                } else {
                    cookieStr += cKey+':'+cVal+'|';
                }
            }
        });

        if(document.cookie.indexOf($(mapDiv).data('recenteqs').cookieId) == 0) {
            $.fn.recentEarthquakesGoogleMap.deleteCookie(mapDiv);
        }
        document.cookie = $(mapDiv).data('recenteqs').cookieId+'='+cookieStr.substr(0,cookieStr.length-1)+';expires='+utcexpiryPreserve+';domain='+document.domain;
        /* }}} */
    }

    $.fn.recentEarthquakesGoogleMap.deleteCookie = function(mapDiv) {
        /* Delete cookie */
        /* {{{ */
        document.cookie = $(mapDiv).data('recenteqs').cookieId+'=False;expires=Thu, 01-Jan-1970 00:00:01 GMT;domain='+document.domain;
        if(document.cookie.indexOf($(mapDiv).data('recenteqs').cookieId) == 0) {
            alert('Cookie not deleted!');
        }
        /* }}} */
    }

    $.fn.recentEarthquakesGoogleMap.addRefresher = function(map, mapDiv, metaDiv, opts) {
        /* Build the refresh functionality and add to map */
        /* {{{ */
        $.each($('select#refresh option'), function() {
            if($(mapDiv).data('recenteqs').refresh_rate == $(this).attr('value')) {
                $(this).attr('selected', 'selected');
            }
        });

        $('select#refresh').change(function() {
            $(mapDiv).data('recenteqs').refresh_rate = $(this).val();
            if($(this).val() != 'None') {
                if($(mapDiv).data('recenteqs').refresh_var) {
                    clearInterval($(mapDiv).data('recenteqs').refresh_var);
                }
                var evRefresh = setInterval(function() {
                    $.fn.recentEarthquakesGoogleMap.addEvents(map, mapDiv, metaDiv, opts);
                }, parseInt($(mapDiv).data('recenteqs').refresh_rate, 10)*1000);
                $(mapDiv).data('recenteqs').refresh_var = evRefresh;
             } else {
                $(mapDiv).data('recenteqs').refresh_rate = false
                if($(mapDiv).data('recenteqs').refresh_var) {
                    clearInterval($(mapDiv).data('recenteqs').refresh_var);
                }
             }
             $.fn.recentEarthquakesGoogleMap.setCookie(map, mapDiv);
        });

        if($(mapDiv).data('recenteqs').preserve_state) {
            $('input#preserveState').attr('checked', 'checked');
            if($(mapDiv).data('recenteqs').refresh_rate) {
                var evRefresh = setInterval(function() {
                    $.fn.recentEarthquakesGoogleMap.addEvents(map, mapDiv, metaDiv, opts);
                }, parseInt($(mapDiv).data('recenteqs').refresh_rate, 10)*1000);
                $(mapDiv).data('recenteqs').refresh_var = evRefresh;
            }
        }

        $('input#preserveState:checkbox').click(function () {
            if( $(this).attr('checked') == 'checked' ) {
                $(mapDiv).data('recenteqs').preserve_state = true;
                if($(mapDiv).data('recenteqs').refresh_rate) {
                    var evRefresh = setInterval(function() {
                        $.fn.recentEarthquakesGoogleMap.addEvents(map, mapDiv, metaDiv, opts);
                    }, parseInt($(mapDiv).data('recenteqs').refresh_rate, 10)*1000);
                    $(mapDiv).data('recenteqs').refresh_var = evRefresh;
                }
                $.fn.recentEarthquakesGoogleMap.setCookie(map, mapDiv);
            } else {
                if($(mapDiv).data('recenteqs').refresh_rate == false && $(mapDiv).data('recenteqs').refresh_var) {
                    clearInterval($(mapDiv).data('recenteqs').refresh_var);
                    $(mapDiv).data('recenteqs').refresh_var = false;
                }
                $.fn.recentEarthquakesGoogleMap.deleteCookie(mapDiv);
            }
        });

        var refreshDiv = document.createElement('DIV');
        refreshDiv.id = 'refreshLabel';
        refreshDiv.className = 'mapoverlay';
        $('#refresherContent').clone(true).show().appendTo($(refreshDiv));
        $(refreshDiv).draggable({containment:'#googlemap', cursor:'move'});
        map.controls[google.maps.ControlPosition.RIGHT_BOTTOM].push(refreshDiv);
        /* }}} */
    }

    $.fn.recentEarthquakesGoogleMap.addMetadata = function(map) {
        /* Build the metadata display */
        /* {{{ */
        var metadataDiv = document.createElement('DIV');
        metadataDiv.id = 'metadataLabel';
        metadataDiv.className = 'mapoverlay';
        $('<span class="ui-icon ui-icon-arrow-4"></span>').appendTo($(metadataDiv));
        $('.metaContent > ul').clone().appendTo($(metadataDiv));
        $(metadataDiv).draggable({containment:'#googlemap', cursor:'move'});
        map.controls[google.maps.ControlPosition.RIGHT_TOP].push(metadataDiv);
        return metadataDiv;
        /* }}} */
    }

    $.fn.recentEarthquakesGoogleMap.updateMetadata = function(metaDiv, metaObj, eventCount) {
        /* Update the metadata display */
        /* {{{ */
        $.each(metaObj, function(k, v) {
            $(metaDiv).find('span[class="'+k+'"]').text(v);
        });
        $(metaDiv).find('span[class="eventnumber"]').text(eventCount);
        /* }}} */
    }

    $.fn.recentEarthquakesGoogleMap.dateRange = function(map, time) {
        /* Build the date range slider based on times */
        /* {{{ */
        var sliderDiv = document.createElement('DIV');
        sliderDiv.id = 'dateRange';
        sliderDiv.className = 'mapoverlay';
        $('#slider-range').slider({
            range: true,
            min: 0,
            max: 500,
            values: [75,300],
            slide: function(event, ui) {
                $("#dates").val(ui.values[0]+'-'+ui.values[1]);
            }
        });
        $('#dates').val($("#slider-range").slider("values", 0)+' - '+$("#slider-range").slider('values', 1));
        // Clone has to happen last and must be set to 'true' to deep clone (objects & behaviors)!
        $('#sliderContent').clone(true).show().appendTo($(sliderDiv))
        map.controls[google.maps.ControlPosition.TOP_CENTER].push(sliderDiv);
        /* }}} */
    }

    $.fn.recentEarthquakesGoogleMap.loadFault = function(map, mapDiv, faultid, faultOpts) {
        /* Load the selected fault */
        /* {{{ */
        var sections = false, polydata, polydata_arr=[];
        $.ajax({
            type: 'GET',
            url: faultOpts[0]+faultid+'.xml',
            async: false,
            success: function(data) {
                $(data).find('markers').each(function() {
                    sections = $(this).find('sections').length;
                    if(sections === 0) {
                        // Continuous line
                        var socalpoly = [];
                        $(this).find('marker').each(function() {
                            var fltmarkers = $(this);
                            var point = new google.maps.LatLng(parseFloat(fltmarkers.attr("lat"), 10), parseFloat(fltmarkers.attr("lng"), 10));
                            socalpoly.push(point);
                        });
                        polydata = new google.maps.Polyline({
                            path: socalpoly,
                            strokeColor: faultOpts[1],
                            strokeOpacity: faultOpts[2],
                            strokeWeight: faultOpts[3]
                        });
                        var bubbletext = faultid.replace(/_/g, " ");
                        var infowindow = new google.maps.InfoWindow({
                            content: '<p style="font-weight:bold;text-transform:uppercase;">'+bubbletext+'</p>'
                        });
                        google.maps.event.addListener(polydata, 'click', function() {
                            infowindow.open(map, socalpoly);
                        });
                        polydata.setMap(map);
                    } else {
                        // Discrete sections
                        sections = true;
                        var nsect = 0;
                        $(this).find('sections').each(function() {
                            var sect=[];
                            $(this).find('marker').each(function() {
                                var fltmarkers = $(this);
                                var point = new google.maps.LatLng(parseFloat(fltmarkers.attr("lat"), 10), parseFloat(fltmarkers.attr("lng"), 10));
                                sect.push(point);
                            });
                            // var namesec = faultid+'_'+nsect;
                            var namesec = nsect;
                            polydata_arr[namesec] = new google.maps.Polyline({
                                path: sect,
                                strokeColor: faultOpts[1],
                                strokeOpacity: faultOpts[2],
                                strokeWeight: faultOpts[3]
                            });
                            var bubbletext = faultid.replace(/_/g, " ");
                            var infowindow = new google.maps.InfoWindow({
                                content: '<p style="font-weight:bold;text-transform:uppercase;">'+bubbletext+'</p>'
                            });
                            google.maps.event.addListener(polydata_arr[namesec], 'click', function() {
                                infowindow.open(map, sect);
                            });
                            polydata_arr[namesec].setMap(map);
                            nsect++;
                        });
                    }
                });
            },
            complete: function() {
                if(sections) {
                    $(mapDiv).data('recenteqs').polylines.push({
                        'id':faultid,
                        'sections':true,
                        'faultdata':polydata_arr
                    });
                } else {
                    $(mapDiv).data('recenteqs').polylines.push({
                        'id':faultid,
                        'sections':false,
                        'faultdata':polydata
                    });
                }
            },
            timeout: function() {
                var dT = $('#dialogTimeout').dialog();
                dT.delay(5000).fadeOut(function() { $(this).dialog('close') });
            },
            error: function() {
                var dE = $('#dialogError').dialog();
                dE.delay(5000).fadeOut(function() { $(this).dialog('close') });
            }
        });
        /* }}} */
    }

    $.fn.recentEarthquakesGoogleMap.unloadFault = function(map, mapDiv, faultid) {
        /* Unload the selected fault */
        /* {{{ */
        $.each($(mapDiv).data('recenteqs').polylines, function(k, v) {
            if(v.id == faultid) {
                if(v.sections) {
                    $.each(v.faultdata, function(subk, subv) {
                        subv.setMap(null);
                    });
                } else {
                    v.faultdata.setMap(null);
                }
            }
        });
        /* }}} */
    }

    $.fn.recentEarthquakesGoogleMap.addEvents = function(map, mapDiv, metaDiv, opts) {
        /* Load the events */
        /* {{{ */
        $.ajax({
            type: 'GET',
            url: opts.eqjsonfile,
            dataType: 'json',
            success: function(data) {
                var evcount = 0;
                $.each(data.events, function(i, evvals) {
                    var evptr = new google.maps.LatLng(parseFloat(evvals.lat, 10), parseFloat(evvals.lon, 10));
                    var evicon = $.fn.recentEarthquakesGoogleMap.evIcon(evvals.color, evvals.magnitude, opts);
                    var evtable = $.fn.recentEarthquakesGoogleMap.evTable({
                        'lat':evvals.lat+'N',
                        'lon':evvals.lon+'E',
                        'depth':evvals.depth+'km',
                        'mag':evvals.magnitude+''+evvals.scale,
                        'localtime':evvals.local_timestring,
                        'utctime':evvals.utc_timestring,
                        'color':evvals.color,
                        'srcname':evvals.srname,
                        'grname':evvals.grname,
                        'author':evvals.auth
                    });
                    var evinfowin = new google.maps.InfoWindow({
                        content: evtable
                    });
                    var evmarker = new google.maps.Marker({
                        position: evptr,
                        map: map,
                        icon: evicon,
                        zIndex: (100 + evcount)
                    });

                    google.maps.event.addListener(evmarker, 'click', function() {
                        evinfowin.open(map, evmarker);
                    });
                    evcount += 1;
                });
                $.fn.recentEarthquakesGoogleMap.updateMetadata(metaDiv, data.metadata, evcount);
            },
            timeout: function() {
                var dT = $('#dialogTimeout').dialog();
                dT.delay(5000).fadeOut(function() { $(this).dialog('close') });
            },
            error: function() {
                var dE = $('#dialogError').dialog();
                dE.delay(5000).fadeOut(function() { $(this).dialog('close') });
            } 
        });
        /* }}} */
    }

    $.fn.recentEarthquakesGoogleMap.evTable = function(tblObj) {
        /* Construct the table */
        /* {{{ */
        var eventDiv = document.createElement('DIV');
        eventDiv.className = 'eventTableDiv';
        $('.evTable > table').clone().show().appendTo($(eventDiv))
        $.each(tblObj, function(k, v) {
            $(eventDiv).find('span[class="'+k+'"]').text(v);
        });
        return eventDiv;
        /* }}} */
    }

    $.fn.recentEarthquakesGoogleMap.evIcon = function(color, mag, opts) {
        /* Create the event icon */
        /* {{{ */
        var iconsize = opts.magScale[parseInt(mag, 10)];
        var iconimgstr = opts.markerdir + color + '_' + parseInt(mag, 10) + '.gif';
        var evicon = new google.maps.MarkerImage(iconimgstr,
            new google.maps.Size(iconsize, iconsize),
            new google.maps.Point(0, 0)
        );
        return evicon
        /* }}} */
    }

    $.fn.recentEarthquakesGoogleMap.addStations = function(map, opts) {
        /* Add stations */
        /* {{{ */
        var markerArray = []
        $.ajax({
            type: 'GET',
            url: opts.stajsonfile,
            success: function(data) {
                var staZIndex = 0;
                $.each(data.active, function(i, sta) {
                    if($.inArray(sta.snet, opts.snet) > -1) {
                        staZIndex += 1;
                        var marker = $.fn.recentEarthquakesGoogleMap.createStaMarker(map, i, sta, opts, staZIndex);
                        markerArray.push(marker);
                    }
                    google.maps.event.addListener(map, 'maptypeid_changed', function() {
                       if(map.getMapTypeId() == 'hybrid' || map.getMapTypeId() == 'satellite') {
                           for(i in markerArray) {
                               markerArray[i].set('labelClass', 'gmapLabelsWhite');
                           }
                       } else {
                           for(i in markerArray) {
                               markerArray[i].set('labelClass', 'gmapLabelsBlk');
                           }
                       }
                    });
                });
            },
            complete: function() {
                // Have to add to the element that will be cloned
                $('#evContent input#staLabel:checkbox').click(function() {
                    for(i in markerArray) {
                        markerArray[i].set('labelVisible', $(this).attr('checked'));
                    }
                });
                $.fn.recentEarthquakesGoogleMap.eventLegend(map);
            }
        });
        /* }}} */
    }

    $.fn.recentEarthquakesGoogleMap.createStaMarker = function(map, stacode, stainfo, opts, zIndex) {
        /* Build station marker */
        /* {{{ */
        var staBubbleDiv = document.createElement('DIV');
        staBubbleDiv.className = 'staBubble';
        $('.staBubble > p').clone().appendTo($(staBubbleDiv));
        $(staBubbleDiv).find('span[class="stacode"]').text(stacode);
        $(staBubbleDiv).find('span[class="staname"]').text(stainfo.staname);
        $(staBubbleDiv).find('span[class="coords"]').text(stainfo.lat+'N, '+stainfo.lon+'E');
        var point = new google.maps.LatLng(stainfo.lat, stainfo.lon);
        var infowindow = new google.maps.InfoWindow({
            content: staBubbleDiv
        });
        var imgstr = opts.markerdir+stainfo.snet+'.gif';
        var image = new google.maps.MarkerImage(imgstr,
            new google.maps.Size(32, 32),
            new google.maps.Point(0, 0)
        );
        var marker = new MarkerWithLabel({
            position: point,
            draggable: false,
            raiseOnDrag: false,
            labelContent: stacode,
            labelAnchor: new google.maps.Point(13, 0),
            labelClass: 'gmapLabelsBlk',
            labelStyle: {opacity:1.0},
            icon: image,
            map: map,
            zIndex: zIndex
        });
        google.maps.event.addListener(marker, 'click', function() {
            infowindow.open(map, marker);
        });
        return marker;
        /* }}} */
    }

    // private debug method
    function debug($obj) {
        if(window.console && window.console.log)
            window.console.log('Recent earthquakes selection count: '+$obj.size());
    }

    //
    // plugin
    //

    $.fn.recentEarthquakesGoogleMap.defaults = {
        /* {{{ */
        eqjsonfile : 'eqs.json',
        stajsonfile : 'stations.json',
        markerdir : '/markers/',
        snet : ['AZ'],
        faultSettings: ['/xml/', '#990000', 1.0, 2],
        refreshsecs : 100,
        initZoom : 8,
        maxZoom : 11,
        defaultLocation : [33.5, -116.5],
        cookieId : 'recenteqs',
        faults: ['san_andreas'],
        magScale : [8, 10, 14, 20, 26, 32, 40, 50, 62, 76, 92]
        /* }}} */
    };

//
// end of closure
//
})(jQuery);
