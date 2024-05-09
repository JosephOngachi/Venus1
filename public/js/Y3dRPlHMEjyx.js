/**
*
* -----------------------------------------------------------------------------
*
* Template : Eventsia | Responsive Education HTML5 Template 
* Author : rs-theme
* Author URI : http://www.rstheme.com/
*
* -----------------------------------------------------------------------------
*
**/

(function($) {
    "use strict";

    // sticky menu
    
    var header = $('.menu-sticky');
    var win = $(window);
    win.on('scroll', function() {
       var scroll = win.scrollTop();
       if (scroll < 1) {
           header.removeClass("sticky");
       } else {
           header.addClass("sticky");
       }
    });
    
    //preloader
	$(window).on( 'load', function() {
		$(".loadding-page").delay(2000).fadeOut(200);
		$(".cssload-box-loading").on('click', function() {
		$(".cssload-box-loading").fadeOut(200);
		})
	})
    
    // Smooth Scroll
    $(".onepage .nav-menu").on('click', 'a', function(e){
        var anchor = $(this);
        $('html, body').stop().animate({
            scrollTop: $(anchor.attr('href')).offset().top - 20
        }, 1000);
        e.preventDefault();
    });
    
    var countdown3 = $('#countdown-3');
	if(countdown3.length){
    $('#countdown-3').timeTo({
        timeTo: new Date(new Date('Tue Aug 24 2018 09:00:00 GMT+0600 (East Kazakhstan Time)')),
        theme: "black",
        displayCaptions: true,
        fontSize: 48,
        captionSize: 14
    });
    }

    /*Team js*/
    var teamstyle4 = $('#team-style4');
	if(teamstyle4.length){
        $("#team-style4").owlCarousel({
            nav: true,
            items : 3,
            loop: true,
            itemsTabletSmall: false,
            autoplay: true,
            margin: 30,
            navText : ["<i class='icofont icofont-bubble-left'></i>","<i class='icofont icofont-bubble-right'></i>"],
            dots: false,
            singleItem : false,
            slideSpeed : 200,
            paginationSpeed : 5000,
            rewindSpeed : 1000,
            autoPlay : true,
            stopOnHover : false,
            pagination : true,
            responsive:{
                0:{
                    items:1
                },
                560:{
                    items:2
                },
                992:{
                    items:2
                },
                1201:{
                    items:3
                },
                1441:{
                    items:3
                }
            }
        });
    }
    

	
	//Slider js 
	/*-------------------------------------
	       Home page Slider
	       -------------------------------------*/	  
	      // Declare Carousel jquery object
	      var owl = $('#home-slider');

	      // Carousel initialization
	      owl.owlCarousel({
	          loop:true,
	          margin:0,
	          navSpeed:800,
	          nav:true,
	          navText: ["<i class='fa fa-angle-left'></i>", "<i class='fa fa-angle-right'></i>"],
	          items:1,
	          autoplay:true,
	          transitionStyle : "fade",
	      });

	      // add animate.css class(es) to the elements to be animated
	      function setAnimation ( _elem, _InOut ) {
	        // Store all animationend event name in a string.
	        // cf animate.css documentation
	        var animationEndEvent = 'webkitAnimationEnd mozAnimationEnd MSAnimationEnd oanimationend animationend';

	        _elem.each ( function () {
	          var $elem = $(this);
	          var $animationType = 'animated ' + $elem.data( 'animation-' + _InOut );

	          $elem.addClass($animationType).one(animationEndEvent, function () {
	            $elem.removeClass($animationType); // remove animate.css Class at the end of the animations
	          });
	        });
	      }

	    // Fired before current slide change
	      owl.on('change.owl.carousel', function(event) {
	          var $currentItem = $('.owl-item', owl).eq(event.item.index);
	          var $elemsToanim = $currentItem.find("[data-animation-out]");
	          setAnimation ($elemsToanim, 'out');
	      });

	    // Fired after current slide has been changed
	      owl.on('changed.owl.carousel', function(event) {

	          var $currentItem = $('.owl-item', owl).eq(event.item.index);
	          var $elemsToanim = $currentItem.find("[data-animation-in]");
	          setAnimation ($elemsToanim, 'in');
	      });
	
	/*-------------------------------------
    OwlCarousel
    -------------------------------------*/
	$('.rs-carousel').each(function() {
		var owlCarousel = $(this),
		loop = owlCarousel.data('loop'),
		items = owlCarousel.data('items'),
		margin = owlCarousel.data('margin'),
		stagePadding = owlCarousel.data('stage-padding'),
		autoplay = owlCarousel.data('autoplay'),
		autoplayTimeout = owlCarousel.data('autoplay-timeout'),
		smartSpeed = owlCarousel.data('smart-speed'),
		dots = owlCarousel.data('dots'),
		nav = owlCarousel.data('nav'),
		navSpeed = owlCarousel.data('nav-speed'),
		xsDevice = owlCarousel.data('mobile-device'),
		xsDeviceNav = owlCarousel.data('mobile-device-nav'),
		xsDeviceDots = owlCarousel.data('mobile-device-dots'),
		smDevice = owlCarousel.data('ipad-device'),
		smDeviceNav = owlCarousel.data('ipad-device-nav'),
		smDeviceDots = owlCarousel.data('ipad-device-dots'),
		mdDevice = owlCarousel.data('md-device'),
		mdDeviceNav = owlCarousel.data('md-device-nav'),
		mdDeviceDots = owlCarousel.data('md-device-dots');

		owlCarousel.owlCarousel({
			loop: (loop ? true : false),
			items: (items ? items : 4),
			lazyLoad: true,
			margin: (margin ? margin : 0),
			//stagePadding: (stagePadding ? stagePadding : 0),
			autoplay: (autoplay ? true : false),
			autoplayTimeout: (autoplayTimeout ? autoplayTimeout : 1000),
			smartSpeed: (smartSpeed ? smartSpeed : 250),
			dots: (dots ? true : false),
			nav: (nav ? true : false),
			navText: ["<i class='fa fa-angle-left'></i>", "<i class='fa fa-angle-right'></i>"],
			navSpeed: (navSpeed ? true : false),
			responsiveClass: true,
			responsive: {
				0: {
					items: (xsDevice ? xsDevice : 1),
					nav: (xsDeviceNav ? true : false),
					dots: (xsDeviceDots ? true : false)
				},
				768: {
					items: (smDevice ? smDevice : 3),
					nav: (smDeviceNav ? true : false),
					dots: (smDeviceDots ? true : false)
				},
				992: {
					items: (mdDevice ? mdDevice : 4),
					nav: (mdDeviceNav ? true : false),
					dots: (mdDeviceDots ? true : false)
				}
			}
		});

	});

    // wow init
    new WOW().init();

    // image popup
	var imaggepoppup = $('.image-popup');
	if(imaggepoppup.length){
		$('.image-popup').magnificPopup({
			type: 'image',
			callbacks: {
				beforeOpen: function() {
				   this.st.image.markup = this.st.image.markup.replace('mfp-figure', 'mfp-figure animated zoomInDown');
				}
			},
			gallery: {
				enabled: true
			}
		});
	}
    
	// video popup
	var popupyoutube = $('.popup-youtube');
	if(popupyoutube.length){
		$('.popup-youtube').magnificPopup({
			disableOn: 700,
			type: 'iframe',
			mainClass: 'mfp-fade',
			removalDelay: 160,
			preloader: false,
			fixedContentPos: false								
		});	
	}
	
    
    // scrollTop init
    var totop = $('#scrollUp'); 
    if(totop.length){	
		win.on('scroll', function() {
			if (win.scrollTop() > 150) {
				totop.fadeIn();
			} else {
				totop.fadeOut();
			}
		});
		totop.on('click', function() {
			$("html,body").animate({
				scrollTop: 0
			}, 500)
		});
	}
    
    // Google Map
    if ($('#googleMap').length) {
        var initialize = function() {
            var mapOptions = {
                zoom: 10,
                scrollwheel: false,
                center: new google.maps.LatLng(40.837936, -73.412551),
                styles: [{
                    stylers: [{
                        saturation: -100
                    }]
                }]
            };
            var map = new google.maps.Map(document.getElementById("googleMap"),
                mapOptions);
            var marker = new google.maps.Marker({
                position: map.getCenter(),
                animation: google.maps.Animation.BOUNCE,
                icon: 'images/map-marker.png',
                map: map
            });
        }
        // Add the map initialize function to the window load function
        google.maps.event.addDomListener(window, "load", initialize);
    }
    
    /* MENU JS */
	var togglebtn = $('.toggle-btn');
	if(togglebtn.length){
		$(".toggle-btn").on("click", function () {
			$(this).toggleClass("active");
			$("body").toggleClass("hidden-menu");
		});
	}
    
     /*----------------------------
    single-productjs active
    ------------------------------ */
	var singleproduct = $('.single-product');
	if(singleproduct.length){
		$('.single-product').slick({
			slidesToShow: 1,
			slidesToScroll: 1,
			arrows: false,
			fade: true,
			asNavFor: '.single-product-nav'
		});
	}
	var singleproductnav = $('.single-product-nav');
	if(singleproductnav.length){
		$('.single-product-nav').slick({
			slidesToShow: 3,
			slidesToScroll: 1,
			asNavFor: '.single-product',
			dots: false,
			focusOnSelect: true,
			centerMode:true,
		});
	}
	
	//CountDown Timer
    var CountTimer = $('.CountDownTimer');
    if(CountTimer.length){ 
        $(".CountDownTimer").TimeCircles({
            fg_width: 0.030,
            bg_width: 0.8,
            circle_bg_color: "#ffffff",
            circle_fg_color: "#ffffff",
            time: {
                Days:{
                    color: "#fff"
                },
                Hours:{
                    color: "#fff"
                },
                Minutes:{
                    color: "#fff"
                },
                Seconds:{
                    color: "#fff"
                }
            }
        }); 
    }
	
	//CountDown Timer
    var CountTimer4 = $('.CountDownTimer2');
    if(CountTimer4.length){ 
        $(".CountDownTimer2").TimeCircles({
            fg_width: 0.030,
            bg_width: 0.8,
            circle_bg_color: "#212121",
            circle_fg_color: "#212121",
            time: {
                Days:{
                    color: "#d90845"
                },
                Hours:{
                    color: "#d90845"
                },
                Minutes:{
                    color: "#d90845"
                },
                Seconds:{
                    color: "#d90845"
                }
            }
        }); 
    }
	//CountDown Timer
    var CountTimer = $('.CountDownTimer3');
    if(CountTimer.length){ 
        $(".CountDownTimer3").TimeCircles({
            fg_width: 0.030,
            bg_width: 0.8,
            circle_bg_color: "#fff",
            circle_fg_color: "#fff",
            time: {
                Days:{
                    color: "#d90845"
                },
                Hours:{
                    color: "#d90845"
                },
                Minutes:{
                    color: "#d90845"
                },
                Seconds:{
                    color: "#d90845"
                }
            }
        }); 
    }
	

})(jQuery);