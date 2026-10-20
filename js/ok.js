!function(){
    var e = [];
    $.cookie("videoTime") && (app.videoElement.currentTime = $.cookie("videoTime")),
    document.addEventListener("contextmenu", function(e) { e.preventDefault() }),
    $(window).on("keydown", function() {
        return 123 != event.keyCode &&
            (!event.ctrlKey || !event.shiftKey || 73 != event.keyCode) &&
            (!event.ctrlKey || 73 != event.keyCode) &&
            (!event.ctrlKey || !event.shiftKey || 74 != event.keyCode) &&
            (!event.ctrlKey || 74 != event.keyCode) &&
            void 0
    }),
    $(".next").click(function() { n() }),
    e.forEach(function(e) { clearTimeout(e) });

    var n = function() {
        e.forEach(function(e) { clearTimeout(e) }),
        $(".startthing").remove(),
        setTimeout(function() {
            new Typed("#Bruh", {
                strings: app.Texts,
                typeSpeed: 40,
                backDelay: 500,
                loop: true,
                onComplete: function() {
                    return $("span").siblings(".typed-cursor").css("opacity", "0");
                }
            })
        }, 1350),
        setTimeout(function() {
            app.videoElement.play(),
            app.videoElement.addEventListener("timeupdate", function() {
                $.cookie("videoTime", app.videoElement.currentTime, { expires: 1 })
            }, !1),
            $(".navbar").css("visibility", "visible").hide().fadeIn(500),
            $(".background").css("visibility", "visible").hide().fadeIn(500),
            $(".main").css("visibility", "visible").hide().fadeIn(500),
            $(".background").fadeIn(200, function() {
                $("#background").animate({ volume: app.musicVolume }, app.musicFadeIn)
            })
        }, 200)
    }
}();