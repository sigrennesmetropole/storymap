var templates = templates || {};
templates.default = function(dom, div, options) {
    this.formatFeatures = function(features, fields) {
        document.addEventListener("ks_click", function(e) {
            /*console.log(e.detail);*/
        });
    };
};
//Fix IE CustomEvent
(function () {
  function CustomEvent ( event, params ) {
    params = params || { bubbles: false, cancelable: false, detail: undefined };
    var evt = document.createEvent( 'CustomEvent' );
    evt.initCustomEvent( event, params.bubbles, params.cancelable, params.detail );
    return evt;
   }

  CustomEvent.prototype = window.Event.prototype;

  window.CustomEvent = CustomEvent;
})();
ks = (function() {
    /*
     * Private
     */
    var _map, featureOverlay, featureSelected, _options, _conf, vectorLayer, info, _template;

    var _projection = ol.proj.get('EPSG:3857');
    var projectionExtent = _projection.getExtent();
    var size = ol.extent.getWidth(projectionExtent) / 256;
    var _WMTSTileMatrix = {'EPSG:3857': [], 'EPSG:4326': [],'EPSG:2154': [],'PM':[]};
    var _WMTSTileResolutions = {'EPSG:3857': [], 'EPSG:4326': [],'EPSG:2154': [],'PM':[]};
    for (var z = 0; z < 22; ++z) {
            // generate resolutions and matrixIds arrays for this GEOSERVER WMTS
            _WMTSTileResolutions['EPSG:3857'][z] = size / Math.pow(2, z);
            _WMTSTileMatrix['EPSG:3857'][z] = 'EPSG:3857:' + z;
            _WMTSTileResolutions['EPSG:4326'][z] = size / Math.pow(2, z);
            _WMTSTileMatrix['EPSG:4326'][z] = 'EPSG:4326:' + z;
            _WMTSTileResolutions['EPSG:2154'][z] = size / Math.pow(2, z);
            _WMTSTileMatrix['EPSG:2154'][z] = 'EPSG:2154:' + z;
    }
     for (var z = 0; z < 20; ++z) {
            // generate resolutions and matrixIds arrays for this GEOPORTAIL WMTS
            _WMTSTileResolutions['PM'][z] = size / Math.pow(2, z);
            _WMTSTileMatrix['PM'][z] = z;
    }
    var displayStatusArray = [];


    var _createStyle = function(options) {
        var options_style = {
            fill: new ol.style.Fill(options.fill),
            stroke: new ol.style.Stroke(options.stroke)
        };

        if (options.circle && options.circle.radius) {
            options_style.image = new ol.style.Circle({
                radius: options.circle.radius,
                fill: new ol.style.Fill(options.fill),
                stroke: new ol.style.Stroke(options.stroke)
            });
        } else if (options.icon && options.icon.src) {
            options_style.image = new ol.style.Icon(({
                anchor: [0.5, 0.5],
                scale: options.icon.scale || 1,
                anchorXUnits: 'fraction',
                anchorYUnits: 'fraction',
                src: options.icon.src
            }))
        }
        return new ol.style.Style(options_style);
    };

    var _createTooltipContent = function(feature, fields, template) {
        var info = "";
        var content = [];
        if (template) {
            info = Mustache.render(template, feature.getProperties())
        } else {
            if (fields.length === 0) {
                content.push(feature.get(_options.data.fields.filter(function(o) {
                    return o.type === 'title';
                })[0].name));
            } else {
                for (var i = 0; i < fields.length; i++) {
                    var text = feature.get(fields[i]);
                    if ((i === 0) && fields.length > 1) {
                        text = "<h5>" + text + "</h5>";
                    }
                    content.push(text);
                }
            }
            info = content.join("</br>");
        }
        return info;
    };

    var _receiveMessage = function (event)
    {
      if (event.origin !== window.location.origin) {
        return;
      } else {
        if (event.data === 'splash-next');
            $('#splash').fadeOut();
            $('#content-title').show();
            $('#content-legend').show(); // 31-01-2019 AJOUT CII
      }

    };

    var _init = function(options) {
        _options = options;
        if (options.menu && options.menu.enabled) {
            $(".nav-is-visible").removeClass("nav-is-visible");
            $("header").show();
        } else {
            $("header").remove();
        }
        //splash config
        if (options.splash && !options.splash.iframe) {
            $("#splash").prepend('<div class="col-md-4 col-md-offset-4"><h1></h1><p></p>');
            $("#splash").css('background-color','rgba(12, 12, 12, .9)');
            $("#splash").show();
            $("#splash h1").text(options.splash.title);
            $("#splash p").text(options.splash.text);
        } else if (options.splash && options.splash.iframe) {
            $("#splash .story-btn-next").remove();
            $("#splash").prepend('<iframe src="'+options.splash.iframe+'" style="height:100%;border:none;width:100%;" scrolling="no"></iframe>');
            $("#splash").css('background-color','#ffffff');
            $("#splash").show();
        } else {
            $("#content-title").show();
            $('#content-legend').show(); // 31-01-2019 AJOUT CII
        }
        window.addEventListener("message", _receiveMessage, false);
        $('#myModal').on('show.bs.modal', function (event) {
              var button = $(event.relatedTarget); // Button that triggered the modal
              var title = button.data('modal-title');
              var body = button.data('modal-body');
              var modal = $(this);
              modal.find('.modal-title').text(title);
              modal.find('.modal-body').text(body);
        });

        //Theme color or css
        if (options.theme && options.theme.css) {
            var cssfile = [_conf, options.theme.css].join("");
            $('head').append('<link rel="stylesheet" href="'+cssfile+'" type="text/css" />');
        } else if (options.theme && options.theme.color) {
            $("#content-title").css("color", options.theme.color);
        }
        //Map title
        $("#content-title h1").text(options.data.title);
        $("#content-title h3").text(options.data.subtitle);

        // 31-01-2019 AJOUT CII :: Map legend for extralayers
        if (options.extralayers && options.extralayers.length > 0) {
            var nbNotShowLegend = 0;
            for (var pos = 0; pos < options.extralayers.length; pos++) {
                //Show legend only if the property 'showLegend' is defined and is true in the config file
                if (options.extralayers[pos].showLegend) {
                    var title = '<div class="legend-title">' + (options.extralayers[pos].legendTitle ? options.extralayers[pos].legendTitle : options.extralayers[pos].layer) + '</div>';
                    var img = '<img src="' + options.extralayers[pos].url +
                        '?service=' + options.extralayers[pos].type +
                        '&request=GetLegendGraphic&width=20&height=20&layer=' + options.extralayers[pos].layer +
                        (options.extralayers[pos].style ? '&style=' + options.extralayers[pos].style : '') +
                        (options.extralayers[pos].sld ? '&SLD=' + options.extralayers[pos].sld : '') +
                        '&FORMAT=' + options.extralayers[pos].format +
                        '&LEGEND_OPTIONS=forceLabels%3Aon%3BfontAntiAliasing%3Atrue&TRANSPARENT=true' + '">';
                    $("#layers-legend").html($("#layers-legend").html() + title + '<div class="legend-div">' + img + '</div>');
                } else {
                    nbNotShowLegend ++;
                }
            }

            if (nbNotShowLegend == options.extralayers.length) {
                $('#content-legend').hide();
            }
        }
        // FIN 31-01-2019 AJOUT CII :: Map legend for extralayers

        //Map width
        $("#map").css("width", options.map.width);
        // templates config
        _template = new templates[options.data.template.name](document, $("#template"));
        // Config map features styles              
        var analyse = _options.data.analyse;
        var _style;
        if ((analyse.type === "categories") && analyse.field && analyse.values.length > 0) {
            // 31-01-2019 AJOUT CII :: Map legend for categories
            var title = '<div class="legend-title"> Catégories </div>';
            $("#categories-legend").html($("#categories-legend").html() + title);
            // FIN 31-01-2019 AJOUT CII :: Map legend for categories

            //Create analyse and legend div
            var rules = {};
            for (var i = 0; i < analyse.values.length; i++) {
                // 31-01-2019 AJOUT CII :: legend div
                var img = analyse.styles[i].icon.src ? '<img class="legend-icon" src="' + analyse.styles[i].icon.src + '">' : '';
                var div = '<div class="legend-div clickable-legend" id="' + analyse.values[i] + '">' + img + analyse.values[i] + '</div>';
                $("#categories-legend").html($("#categories-legend").html() + div);
                // FIN 31-01-2019 AJOUT CII :: legend div

                var options_style = analyse.styles[i];
                rules[analyse.values[i]] = _createStyle(options_style);
            }
            _style = function(feature, resolution) {
                return [rules[feature.get(analyse.field)]];
            };

        } else if (analyse.type === "single") {
            // All features are displayed with the same style
            var options_style = analyse.styles[0];
            _style = _createStyle(options_style);
        }

        var _highlight = _createStyle(options.data.hightlightstyle);
        featureOverlay = new ol.layer.Vector({
            source: new ol.source.Vector(),
            style: _highlight
        });
        featureSelected = new ol.layer.Vector({
            source: new ol.source.Vector(),
            style: _highlight
        });
        //Config map controls
        var _controls = ol.control.defaults();
        if (options.map.overview) {
            _controls.extend([
                new ol.control.OverviewMap({
                    className: 'ol-overviewmap ol-custom-overviewmap',
                    collapseLabel: '\u00BB',
                    label: '\u00AB',
                    collapsed: false
                })
            ]);
        }

        // Config map

        // 20181212 CII :: Adding multi-layers support -- STARTS HERE

        // Array of layers for map creation
        var _layerArray = [];

        // Function to create a layer and push it into the _layerArray
        var _computelayer = function(layer, isBackground) {
            var _layer;
            if (layer && layer.type && layer.url) {
                switch (layer.type) {
                    case "WMS":
                        _layer =  new ol.layer.Tile({
                            opacity: layer.opacity,
                            source: new ol.source.TileWMS({
                                url: layer.url,
                                params: {
                                    'LAYERS': layer.layer,
                                    'VERSION': '1.1.1',
                                    'FORMAT': layer.format,
                                    'TILED': true,
                                    'STYLES': layer.style || null,
                                    'CQL_FILTER': layer.filter || null,
                                    'SLD': layer.sld || null
                                }
                            })
                        });
                        break;

                    case "WMTS":
                        _layer = new ol.layer.Tile({
                            source: new ol.source.WMTS({
                                url: layer.url,
                                layer: layer.layer,
                                matrixSet: layer.tilematrixset,
                                style: layer.style,
                                format: layer.format,
                                projection: _projection,
                                tileGrid: new ol.tilegrid.WMTS({
                                    origin: ol.extent.getTopLeft(projectionExtent),
                                    resolutions: _WMTSTileResolutions[layer.tilematrixset],
                                    matrixIds: _WMTSTileMatrix[layer.tilematrixset]
                                })
                            })
                        });
                        break;

                    default :
                        break;
                }
            } else {
                if (isBackground) {
                    _layer = new ol.layer.Tile({
                        source: new ol.source.OSM({
                            url: options.map.url
                        })
                    });
                }
            }

            _layerArray.push(_layer);
        }

        // Background layer to compute first
        _computelayer(options.backgroundlayer, true);

        // Iteration over extra-layers in config.json
        if (options.extralayers) {
            options.extralayers.forEach(function(el){
                _computelayer(el, false);
            });
        }

        _map = new ol.Map({
            controls: _controls,
            layers: _layerArray,
            target: 'map',
            view: new ol.View({
                center: options.map.center,
                zoom: options.map.zoom
            })
        });

        // 20181212 CII :: Adding multi-layers support -- ENDS HERE

        //Configure map features tooltips
        info = $('#feature-info');
        info.tooltip({
            animation: false,
            trigger: 'manual',
            html: true,
            template: '<div class="tooltip tooltip-custom" role="tooltip"><div class="tooltip-custom tooltip-arrow"></div><div class="tooltip-custom tooltip-inner"></div></div>'
        });
        //Register map events
        _map.on('pointermove', _mouseOverFeature);
        _map.on('singleclick', _clickFeature);
        $("#panel-story").hover(function() {
            featureOverlay.getSource().clear();
            info.tooltip('hide');
            document.getElementById("map").style.cursor = '';
        });

        // get Features + add optional extra data annd add this features to the map
        $.getJSON(options.data.url, function(data) {
            var vectorSource = new ol.source.Vector({
                features: (new ol.format.GeoJSON()).readFeatures(data)
            });
            // if id is not set in geojson, set id for each feature with the options.data.id present in the config file
            if (options.data.id) {
                vectorSource.getFeatures().forEach(function(feature){
                    feature.setId(feature.getProperties()[options.data.id]);
                });
            }
            vectorLayer = new ol.layer.Vector({
                source: vectorSource,
                style: _style
            });

            // Get Extra data to join to existing features
            if (options.extradata.url) {
                Papa.parse(_conf + options.extradata.url, {
                    download: true,
                    header: true,
                    error: function(err) {
                        var reoderFeatures = vectorSource.getFeatures().sort(_orderFeatures(_options.data.orderby));
                        _template.formatFeatures(reoderFeatures.filter(_removeFakeFeatures), _options.data);
                    },
                    complete: function(results) {
                        $.each(results.data, function (index, extra) {
                            if (extra[_options.extradata.linkfield || 'featureid']) {
                                var feature = vectorSource.getFeatureById(extra[_options.extradata.linkfield || 'featureid']);
                                if (feature) {
                                    $.each(extra, function (prop, value) {
                                        if (prop !== extra[_options.extradata.linkfield || 'featureid']) {
                                            feature.set(prop, value);
                                        }
                                    });
                                }
                            }
                        });
                        var reoderFeatures = vectorSource.getFeatures().sort(_orderFeatures(_options.data.orderby));
                        _template.formatFeatures(reoderFeatures.filter(_removeFakeFeatures), _options.data);

                        // 31-01-2019 AJOUT CII :: Creating a layer for each category - Needed to make the legend clickable
                        if ((analyse.type === "categories") && analyse.field && analyse.values.length > 0) {
                            var vectorLayersArray = [];
                            //var displayStatusArray = [];
                            for (var i = 0; i < analyse.values.length; i++) {
                                var categoryVectorSource = new ol.source.Vector({
                                    features: []
                                });
                                vectorSource.getFeatures().forEach(function (feature) {
                                    if (feature.getProperties()['categorie'] === analyse.values[i]) {
                                        categoryVectorSource.addFeature(feature);
                                    }
                                });
                                var categoryVectorLayer = new ol.layer.Vector({
                                    source: categoryVectorSource,
                                    style: _style
                                });
                                vectorLayersArray[analyse.values[i]] = categoryVectorLayer;
                                _map.addLayer(categoryVectorLayer);
                                displayStatusArray[analyse.values[i]] = true;
                            }

                            _map.addLayer(featureOverlay);
                            _map.addLayer(featureSelected);

                            // Event when a category is clicked in the legend
                            $(".clickable-legend").click(function (event) {
                                var id = event.target.id;

                                _map.removeLayer(featureOverlay);
                                _map.removeLayer(featureSelected);

                                if (displayStatusArray[id]) {
                                    _map.removeLayer(vectorLayersArray[id]);
                                    displayStatusArray[id] = false;
                                    $(event.target).addClass('hidden-on-map');

                                    // 04-02-2019 AJOUT CII :: Hiding carousel buttons if no category selected
                                    $('.carButton').addClass('hidden');
                                    for (var key in displayStatusArray) {
                                        if (displayStatusArray[key]) {
                                            $('.carButton').removeClass('hidden');
                                            break;
                                        }
                                    }
                                    // FIN 04-02-2019 AJOUT CII :: Hiding carousel buttons if no category selected
                                } else {
                                    _map.addLayer(vectorLayersArray[id]);
                                    displayStatusArray[id] = true;
                                    $(event.target).removeClass('hidden-on-map');
                                    $('.carButton').removeClass('hidden'); // Make carousel buttons visible
                                }

                                _map.addLayer(featureOverlay);
                                _map.addLayer(featureSelected);

                                var actual_slide = parseInt($(".nextButton a").attr("data-actual-slide"));
                                var value = ks.getProgress(actual_slide);
                                $('.progress-bar').css('width', value + '%').attr('aria-valuenow', value);
                            });
                        } else {
                            _map.addLayer(vectorLayer);
                            _map.addLayer(featureOverlay);
                            _map.addLayer(featureSelected);
                        }
                        // FIN 31-01-2019 AJOUT CII :: Creating a layer for each category - Needed to make the legend clickable
                    }
                });
            } else {
                var reoderFeatures = vectorSource.getFeatures().sort(_orderFeatures(_options.data.orderby));
                _template.formatFeatures(reoderFeatures.filter(_removeFakeFeatures), _options.data);

                // 31-01-2019 MODIFICATION CII :: Moved this part here to keep initial behaviour if no category legend
                _map.addLayer(vectorLayer);
                _map.addLayer(featureOverlay);
                _map.addLayer(featureSelected);
            }
        });
    };
    // Detect subfolder path. if subfolder is detected in url eg map1 in http://thisapp/map1/ ,application will be use the directory thisapp/stories/map1/ to get config.json.
    //If no subfolder detected, the config.json in thisapp directory will be used.
    var sub;
    if (document.documentURI) {
        var delta = document.documentURI.replace(document.baseURI, "");
        sub = delta.substring(0, delta.search("/"));
    } else {
        sub = window.location.href.split("/").reverse()[1];
    }
    if (sub.length > 1) {
        _conf = "stories/" + sub + "/";
    } else {
        _conf = "";
    }
    // Get config file
    $.ajax({
        dataType: "json",
        url: _conf + "config.json",
        success: function(options) {
            /*console.log(options);*/
            _init(options);
        },
        error: function(xhr, ajaxOptions, thrownError) {
            console.log("error getting config file");
        }
    });

    var _removeFakeFeatures = function (feature) {
        return feature.getId() !== "fake";
    }

    var _orderFeatures = function(key) {
        return function(a, b) {
            var ret = 0;
            if (parseInt(a.get(key) || 100) > parseInt(b.get(key))) {ret = 1;}
            if (parseInt(a.get(key)) < parseInt(b.get(key))) {ret = -1;}
            return ret;
        }
    };


    var _mouseOverFeature = function(evt) {
        if (evt.dragging) {
            return;
        }
        featureOverlay.getSource().clear();
        var pixel = _map.getEventPixel(evt.originalEvent);
        info.css({
            left: pixel[0] + 'px',
            top: (pixel[1] - 15) + 'px'
        });
        var feature = _map.forEachFeatureAtPixel(pixel, function(feature) {
            return feature;
        });
        if (feature) {
            info.tooltip('hide')
                .attr('data-original-title', _createTooltipContent(feature, _options.tooltip.fields || [], _options.tooltip.template))
                .tooltip('fixTitle')
                .tooltip('show');
            featureOverlay.getSource().addFeature(feature);
        } else {
            info.tooltip('hide');
            document.getElementById("map").style.cursor = '';
        }
    };

    var _clickFeature = function(evt) {
        var pixel = _map.getEventPixel(evt.originalEvent);
        var feature = _map.forEachFeatureAtPixel(pixel, function(feature) {
            return feature;
        });
        if (feature) {
            var event = new CustomEvent('ks_click', {
                'detail': feature.getProperties()
            });
            document.dispatchEvent(event);
        }
    };

    var _zoomTo = function(coordinates, item, featureid, offset) {
        var mapPosition = coordinates;
        var actualCenter = _map.getView().getCenter();
        var actualSelectedFeature = featureSelected.getSource().getFeatures()[0];
        if (actualSelectedFeature != null){
            var actualSelectedCoord = actualSelectedFeature.getGeometry().getCoordinates();
        }

        info.tooltip('hide');
        featureOverlay.getSource().clear();
        var feat = vectorLayer.getSource().getFeatureById(featureid);
        featureSelected.getSource().clear();
        featureSelected.getSource().addFeature(feat);
        // zoom animation
        var duration = null;
        if (_options.map.animation) {
            var resolution =  _map.getView().getResolutionForExtent(feat.getGeometry().getExtent());
            var zoom = _map.getView().getZoom();
            if (resolution > 0) {
                var zoom =  _map.getView().getZoomForResolution(resolution);
            }
            var center = ol.extent.getCenter(feat.getGeometry().getExtent());
            var duration = 1800;
            // 20181204 AJOUT CBR
            // calcul offset X en fonction du niveau de zoom
            var ratio = _map.getView().constrainResolution(_map.getView().a, zoom, 0);
            // 20181204 FIN AJOUT CBR
            _map.getView().animate({
              // 20181204 MODIF CBR
              //center: center,
              center: new Array(center[0]+(offset/2*ratio), center[1]),
              // 20181204 FIN MODIF CBR
              duration: duration
            });

            _map.getView().animate({
              zoom: zoom - 1,
              duration: duration / 2
            }, {
              zoom: zoom,
              duration: duration / 2
            });

            //Todo center with offset

        } else {
            _map.getView().fit(feat.getGeometry(), { size: _map.getSize(), padding: [0, offset, 0, 0], nearest: false, maxZoom: _options.map.zoom});
        }
    };



    return {
        /*
         * Public
         */

        version: "0.1",

        zoomTo: function(coordinates, item, featureid, offset) {
            _zoomTo(coordinates, item, featureid, offset);
        },

        menuaction: function (event, action) {
            event.preventDefault();
            switch (action) {
                case 'home':
                    if ($("#splash")[0].getElementsByTagName("IFRAME").length > 0) {
                        $("#splash").show();
                    } else {
                        // AJOUT CBR
                        // no splash screen , initiate the map on the first element
                        setDataActualSlide(0);
                    }
                    break;
                case 'zoomplus':
                    _map.getView().animate({zoom: _map.getView().getZoom() + 1});
                    break;
                case 'zoommoins':
                    _map.getView().animate({zoom: _map.getView().getZoom() - 1});
                    break;
                case 'extent':
                    var extent = vectorLayer.getSource().getExtent();
                    var offset = $("#panel-story").width();
                    _map.getView().fit(extent, _map.getSize(), {
                        padding: [0, offset, 0, 0]
                    });
                    break;
                case 'infos':
                    $("#panel-infos").modal('show');
                    break;
                case 'share':
                    $("#panel-share").modal('show');
                    break;
            }
        },
        popupPhoto: function (src, title, sources) {
            $("#imagepopup").find("img").attr("src",src) ;
            if (title) {
                 $("#imagepopup .modal-title").text(title);
            } else {
                $("#imagepopup .modal-title").text("");
            }
            if (sources) {
                $("#imagepopup figcaption").text(sources);
            } else {
                $("#imagepopup figcaption").text("");
            }
            $("#imagepopup").modal('show');
        },

        popupIframe: function (src) {
            $("#iframepopup").find("iframe").attr("src",src) ;
            $("#iframepopup").modal('show');
        },

        refreshMap: function () {
            _map.updateSize();
        },

        audio: function (item) {
            //Stop all sounds
            $("audio").each(function(id, audio) {audio.pause();});
            //Play current sound if exists
            $(item).find("audio").first().each(function(id, audio) {audio.play();});

        },

        // 04-02-2019 AJOUT CII :: Changing carousel behaviour if categories in the legend are activated or not
        getPrevAvailable: function (actualPos) {
            var features = vectorLayer.getSource().getFeatures().sort(_orderFeatures(_options.data.orderby));

            if (actualPos > 0) {
                for (var prevPos = actualPos - 1; prevPos >= 0; prevPos--) {
                    if (features[prevPos] && (!features[prevPos].getProperties()['categorie'] || displayStatusArray[features[prevPos].getProperties()['categorie']])) {
                        return prevPos;
                    }
                }
            }

            return actualPos;
        },

        getNextAvailable: function (actualPos) {
          var features = vectorLayer.getSource().getFeatures().sort(_orderFeatures(_options.data.orderby));
          if (actualPos < features.length) {
              for (var nextPos = actualPos + 1; nextPos <= features.length; nextPos++) {
                  if (features[nextPos] && (!features[nextPos].getProperties()['categorie'] || displayStatusArray[features[nextPos].getProperties()['categorie']])) {
                      return nextPos;
                  }
              }
          }

          return actualPos;
        },

        getProgress: function(nextPos) {
            var features = vectorLayer.getSource().getFeatures().sort(_orderFeatures(_options.data.orderby));
            var posInProgress = 1;
            var totalFeaturesSelected = 0;

            for (var pos = 0; pos < features.length; pos++) {
                if (!features[pos].getProperties()['categorie'] || displayStatusArray[features[pos].getProperties()['categorie']]) {
                    totalFeaturesSelected ++;
                    if (pos < nextPos) {
                        posInProgress ++;
                    }
                }
            }

            if (posInProgress === 1) {
                $('.precButton').css('opacity', 0.5);
            } else {
                $('.precButton').css('opacity', 1);
            }

            if (posInProgress === totalFeaturesSelected) {
                $('.nextButton').css('opacity', 0.5);
            } else {
                $('.nextButton').css('opacity', 1);
            }

            return (posInProgress / totalFeaturesSelected) * 50; // only 50% of the width is used for the progress bar
        }
        // FIN 04-02-2019 AJOUT CII :: Changing carousel behaviour if categories in the legend are activated or not
    };

}());

// AJOUTS CBR Rennes Metropole - Gestion du défilement de photos/video (panel + pop-up)

function getpopupslide(idSlider, id, posSlide, urlCSSlocal){
    // créer le code HTML de l iframe qui affiche un carroussel d'images
    var codeHTML='data:text/html,';
    var premiernumSlide="";
    var serveurlocal=window.location.origin+"/storymap/";

    var aRecuperer=document.getElementById(idSlider).getElementsByClassName("slick-slide");
    var listURL=new Array();
    for (var i = 0, len = aRecuperer.length; i < len; i++ ) {
        if (aRecuperer[i].getAttribute("role") && aRecuperer[i].getAttribute("role")=="tabpanel"){
            listURL.push(aRecuperer[i]);
            if (premiernumSlide=="" && aRecuperer[i].id){
                premiernumSlide=aRecuperer[i].id;
            }
        }
    }
    codeHTML +='<meta charset="UTF-8">';
    codeHTML +='<link rel="stylesheet" href="' + serveurlocal + 'css/storymap.css" type="text/css">';
    if (urlCSSlocal){
        codeHTML +='<link rel="stylesheet" href="'+ serveurlocal + urlCSSlocal +'" type="text/css">';
    }
    codeHTML +='<link rel="stylesheet" type="text/css" href="' + serveurlocal + 'lib/slick-1.8.1/slick/slick.css"/>';
    codeHTML +='<link rel="stylesheet" type="text/css" href="' + serveurlocal + 'lib/slick-1.8.1/slick/slick-theme.css"/>';


    codeHTML +='<section class="slide-feature-popup"><div id="slidepopup' + id + '" >';
    for (i = 0, len = listURL.length; i < len; i++ ) {
        var contenu = listURL[i].innerHTML;
        // prise en compte du nom de serveur
        contenu = contenu.replace(/"stories\/(.*)" class/, '"'+serveurlocal+'stories/$1" class');
        codeHTML += "<div>";
        if (contenu.substring("allowfullscreen",0)>=0){
            //codeHTML += contenu.replace(/style="(.*)px;"/, 'style="height:340px;width:550px;"');
            codeHTML += contenu.replace(/style="(.*)px;"/, 'style="height:95%;"');
        }else {
            //codeHTML += contenu.replace(/style="(.*)px;"/, 'style="height:340px"');
            codeHTML += contenu.replace(/style="(.*)px;"/, 'style="height:340px"');
        }
        codeHTML += "</div>";
    }
    codeHTML +='</div></section>';

    codeHTML +='<script type="text/javascript" src="' + serveurlocal + 'lib/jquery_1.12.4/jquery.min.js"></script>';
    codeHTML +='<script type="text/javascript" src="' + serveurlocal + 'lib/jquery-migrate-1.2.1.min.js"></script>';
    codeHTML +='<script type="text/javascript" src="' + serveurlocal + 'lib/slick-1.8.1/slick/slick.min.js"></script>';
    codeHTML += "<script>$(document).ready(function(){$('%23slidepopup" + id +"').slick({dots:true, arrows:true, slidesToScroll:1, slidesToShow: 1, initialSlide: "+ posSlide +"});});</script>";

    return codeHTML;
};

/*function getInitialSlide(premierslide, rechercheSlide){
    // définit la première image à afficher sur le pannel de chaque Element
    // récupère le numéro de slide à afficher en premier calculé sur les id autogénérés (id de la slide recherché - id de la 1er slide du même carousel)
    var templateId = "slick-slide";
    var numPremierSlide = premierslide.substring(premierslide.indexOf(templateId,0)+templateId.length,premierslide.length);
    var numSlideRecherche = rechercheSlide.substring(rechercheSlide.indexOf(templateId,0)+templateId.length,rechercheSlide.length);

    return Number(numSlideRecherche)-Number(numPremierSlide);
}*/

function setDataActualSlide(numslide){
    $('.carousel').carousel(numslide);
    $("div.carButton a").each(function() {
        $(this).attr("data-actual-slide",numslide);
    });
}

function getNumSlideFromDataFeatureId(datafeatureId){
    // récupération de l'ID de l'élément qui est au format cXX (XX étant un numérique croissant à partir de 1)
    var divId = $("div[data-featureid="+datafeatureId+"]")[0].id;
    // le numéro de slide est XX -1 (les slides commencent à 0)
    return (parseInt(divId.substring(1))-1);

}

