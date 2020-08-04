"use strict";
var templates = templates || {};
/* this template is called by this expression : 

var template = new templates.carousel(document, $("#template"));

*/
templates.carousel = function(dom, div) {
    var _dom = dom;
    var _div = div;
    var _tpl;     
    var _audioAutoplay = true;
    var panel_width = function () {
        var width = 0;
        if (document.body.clientWidth >= 768) {
            width = $("#panel-story").width();
        }
        return width;
    };

    var _setProgress = function(value) {
        $('.progress-bar').css('width', value + '%').attr('aria-valuenow', value);
    };

    this.version = "0.1";
    //Mandatory
    var _updateDom = function() {
        //Add css
        $(_dom.head).append('<link rel="stylesheet" href="templates/carousel.css" type="text/css" />');        
        _div.append('<div id="panel-story"  class="col-sm-12 panel-story-carousel" ></div>');

        var tpl = ['<div id="myCarousel" class="carousel slide" data-ride="carousel" data-interval="false">',
            '<ol class="carousel-indicators" style="display: none;"></ol>',
            '<div class="carousel-inner" role="listbox"></div>',
            '<a class="left carousel-control" href="#myCarousel" role="button" data-slide="prev">',
            '<span class="glyphicon glyphicon-chevron-left" aria-hidden="true"></span>',
            '<span class="sr-only">Previous</span>',
            '</a>',
            '<a class="right carousel-control" href="#myCarousel" role="button" data-slide="next">',
            '<span class="glyphicon glyphicon-chevron-right" aria-hidden="true"></span>',
            '<span class="sr-only">Next</span>',
            '</a>',
            '</div>'
        ].join("");
        $("#panel-story").append(tpl);
        _div.append([
            '<div class="carButton precButton" style="opacity: 0.5;">',
            '<a data-actual-slide="0" onclick="$(\'.carousel\').carousel(ks.getPrevAvailable(parseInt(this.getAttribute(\'data-actual-slide\'))));"> </a>',
            '</div>',
            '<div class="carButton nextButton" style="opacity: 1;">',
            '<a data-actual-slide="0" onclick="$(\'.carousel\').carousel(ks.getNextAvailable(parseInt(this.getAttribute(\'data-actual-slide\'))));"> </a></div>',
            '<div class="progress">',
            '<div class="progress-bar progress-bar-custom" role="progressbar" aria-valuenow="0" aria-valuemin="0" aria-valuemax="100" style="width: 0%;">',
            '<span class="sr-only">0% Complete</span>',
            '</div>',
            '</div>'
        ].join(""));       
        return false;
    };

    var _createCarousel = function(data) {
        $(".carousel-indicators").append(data.carousel_indicators);
        $(".carousel-inner").append(data.carousel_items);
        $(".carousel-indicators .item").first().addClass("active");
        $(".carousel-inner .item").first().addClass("active");
        $(".carousel").carousel();
        $(".carousel").on('slide.bs.carousel', function(e) {
            var actual_slide = parseInt($(".nextButton a").attr("data-actual-slide"));
            var direction = (e.direction === "right") ? ks.getPrevAvailable(actual_slide) : ks.getNextAvailable(actual_slide);
            ks.zoomTo(e.relatedTarget.attributes["data-position"].value.split(",").map(Number),
                e.relatedTarget.attributes["id"].value,
                e.relatedTarget.attributes["data-featureid"].value,
                panel_width());
            _setProgress(ks.getProgress(direction));
            $(".carButton a").attr("data-actual-slide", direction);
            ks.audio("#c" + parseInt(direction + 1));

        });
        // Show Photos in popup on click
        $("#panel-story .image-popup").click(function(){ks.popupPhoto($(this).attr("src"),$(this).attr("data-title"),$(this).attr("data-sources"))});
        // Show iframe in popup on click
        $("#panel-story .iframe-popup").click(function(){ks.popupIframe($(this).attr("src"))});
        var el = $("[data-slide-to='0']");
        ks.zoomTo(el.attr("data-position").split(",").map(Number), el.attr("id"), el.attr("data-featureid"), panel_width());
        _setProgress(parseInt(1 / $(".item").length * 100));
        //play audio if exists
        if (_audioAutoplay) {            
            $("audio").each(function(id, audio) {audio.addEventListener('ended', function (e) {
                     $(".carousel").carousel('next');
                    });}
            );
            ks.audio("#c1");            
        }
    };

    var _renderFeaturesTpl = function(features) {
        var carousel_items = [];
        var carousel_indicators = [];
        var counter = 0;
        for (var i = 0; i < features.length; i++) {
            counter += 1;
            var feature = features[i];
            feature.set("storyid", counter);
            var content = Mustache.render(_tpl, feature.getProperties());
            var position = ol.extent.getCenter(feature.getGeometry().getExtent()).join(",");

            carousel_items.push(['<div id="c' + (counter) + '" class="item" data-featureid="' + feature.getId() + '" data-position="' + position + '" >',
                content,
                '<div class="ks-space"></br></br></br></br></br></div></div>'
            ].join(" "));

            carousel_indicators.push('<li data-target="#myCarousel" data-slide-to="' + (counter - 1) + '" data-featureid="' + feature.getId() + '" data-position="' + position + '" ></li>');

        }

        return {
            "carousel_indicators": carousel_indicators,
            "carousel_items": carousel_items
        };
    };

    var _renderFeatures = function(features, fields) {
        var carousel_items = [];
        var carousel_indicators = [];
        var counter = 0;
        for (var i = 0; i < features.length; i++) {
            counter += 1;
            var feature = features[i];
            feature.set("storyid", counter);
            var content = {
                title: "",
                text: [],
                background: "",
                style: [],
                classes: ["item"]
            };
            for (var j = 0; j < fields.length; j++) {
                switch (fields[j].type) {
                    case "title":
                        content.title = '<h2>' + feature.get(fields[j].name) + '</h2>';
                        break;
                    case "text":
                        content.text.push('<div class="' + fields[j].name + '">' + (feature.get(fields[j].name) || "") + '</div>');
                        break;
                    case "image":
                        content.text.push('<img class="' + fields[j].name + '" src="' + (feature.get(fields[j].name) || "") + '" class="img-responsive"></img>');
                        break;
                    case "background":
                        content.classes.push("background");
                        content.style.push(['#c' + counter + ':before {',
                            'background:url(' + feature.get(fields[j].name) + ')',
                            'no-repeat center top;',
                            'background-size: cover;',
                            'content: \' \';',
                            'display: block;',
                            'position: absolute;',
                            'left: 0;',
                            'top: 0;',
                            'width: 100%;',
                            'height: 100%;',
                            'z-index: -1; }'
                        ].join(" "));
                        content.style.push('#c' + counter + '{ position: relative;');
                        break;
                    case "url":
                        content.text.push('<a class="' + fields[j].name + '" title="Ouvrir dans une nouvelle fenêtre" href="' + (feature.get(fields[j].name) || "") + '" target="_blank" >En savoir plus</a>');
                        break;
                    case "iframe":
                        content.text.push('<iframe class="'+fields[j].name+'" src="'+feature.get(fields[j].name) +'" scrolling="no" frameborder="0" allowfullscreen></iframe>');
                        break;
                    default:
                        content.text.push('<div class="' + fields[j].name + '" >' + (feature.get(fields[j].name) || "") + '</div>');
                }
            }

            var position = ol.extent.getCenter(feature.getGeometry().getExtent()).join(",");

            carousel_items.push(['<div id="c' + (counter) + '" class="' + content.classes.join(" ") + '" data-featureid="' + feature.getId() + '" data-position="' + position + '" >',
                content.background,
                content.title,
                content.text.join(" "),
                '<div class="ks-space"></br></br></br></br></br></div></div>'
            ].join(" ") + ['<style>', content.style.join(" "), '</style>'].join(" "));


            carousel_indicators.push('<li data-target="#myCarousel" data-slide-to="' + (counter - 1) + '" data-featureid="' + feature.getId() + '" data-position="' + position + '" ></li>');

        }

        return {
            "carousel_indicators": carousel_indicators,
            "carousel_items": carousel_items
        };
    };

    //Mandatory
    this.formatFeatures = function(features, opt) {
        var items;
        if (opt.tpl) {
            $.get(opt.tpl, function(template) {
                _tpl = template;
                Mustache.parse(_tpl);
                items = _renderFeaturesTpl(features);
                _createCarousel(items);
            });
        } else {
            items = _renderFeatures(features, opt.fields);
            _createCarousel(items);
        }        
        ks.refreshMap();
    };


    document.addEventListener("ks_click", function(e) {
        $('.carousel').carousel(e.detail.storyid - 1);
        $(".carButton a").attr("data-actual-slide", e.detail.storyid - 1);

        var actual_slide = parseInt($(".nextButton a").attr("data-actual-slide"));
        _setProgress(ks.getProgress(actual_slide));
    });

    _updateDom();
    
    $("#myCarousel").on("touchstart", function(event){
            var xClick = event.originalEvent.touches[0].pageX;
            $(this).one("touchmove", function(event){
            var xMove = event.originalEvent.touches[0].pageX;
            if( Math.floor(xClick - xMove) > 5 ){
                $(".carousel").carousel('next');
            }
            else if( Math.floor(xClick - xMove) < -5 ){
                $(".carousel").carousel('prev');
            }
        });
        $(".carousel").on("touchend", function(){
                $(this).off("touchmove");
        });
    });

};