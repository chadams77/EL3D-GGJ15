var GAME = GAME || {};

// Automatically resizes game area to full screen
// functions PX and PY convert world units to game units
// Where GH (game height) is always 100, and GW (game width) is always 100 * the aspect ratio

GAME.Init = function ( )
{
    GAME.SW = $(window).width();
    GAME.SH = $(window).height();

    $(window).resize(function(){
        GAME.SW = $(window).width();
        GAME.SH = $(window).height();
        //game.renderer.resize(GAME.W, GAME.H);
    });

};