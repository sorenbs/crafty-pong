window.onload = function() {
	Crafty.init(700, 400);
	Crafty.background('rgb(127,127,127)');

	var isMaster = false;

	Crafty.scene('Connect', function() {
		Crafty.e("2D, DOM, Text").attr({ w: 700, h: 20, x: 0, y: 180 })
			.text("Connecting...")
			.css({ "text-align": "center" });

		Craftys.register("nhfu4fn8fgjwnf", function(clients) {
			//The first client is master
			isMaster = clients == 1;
			Crafty.scene('Main');
		});
	});
	Crafty.scene('Connect');

	Crafty.scene('Main', function() {
		//Paddles
		Crafty.e("Paddle, 2D, DOM, Color, Multiway")
			.color('rgb(255,0,0)')
			.attr({x:20, y:200, w:10, h:150})
			.multiway(4, {W:-90, S:90})
			.bind('Moved',function() {
				Craftys.triggerRemote('LeftPaddleState', {y: this.y});
			})
			.bind('LeftPaddleState', function(m) {
				this.attr({y:m.y});
			});
		Crafty.e("Paddle, 2D, DOM, Color, Multiway")
			.color('rgb(0,255,0)')
			.attr({x:680, y:200, w:10, h:150})
			.multiway(4, {UP_ARROW:-90, DOWN_ARROW:90})
			.bind('Moved',function() {
				Craftys.triggerRemote("RightPaddleState", {y: this.y});
			})
			.bind('RightPaddleState', function(m) {
				this.attr({y:m.y});
			});;

		//Ball
		var ball = Crafty.e("Ball, 2D, DOM, Color, Collision")
			.color('rgb(0,0,255)')
			.attr({x:350, y: 200, w:10, h:10, dX: Crafty.randRange(2,5), dY: Crafty.randRange(2,5)})
			.onHit('Paddle', function() {
				this.dX *= -1;
			});
		if(isMaster)
			ball.bind('EnterFrame', function() {
				//hit floor or roof
				if(this.y <= 0 || this.y >= 390)
					this.dY *= -1;

				if(this.x > 700) {
					this.x = 350;
					Crafty("LeftPaddle").each(function() {
						this.text(++this.points + " Points")
						Craftys.triggerRemote("LeftPointState", {points: this.points});
					});

				}
				if(this.x < 10) {
					this.x = 350;
					Crafty("RightPaddle").each(function() {
						this.text(++this.points + " Points")
						Craftys.triggerRemote("RightPointState", {points: this.points});
					});
				}

				this.x += this.dX;
				this.y += this.dY;
				if(Crafty.frame()%30 === 0)
					Craftys.triggerRemote("BallState", {x: this.x, y: this.y, dX: this.dX, dY: this.dY});
			});
		else {
			ball.bind('EnterFrame', function() {
				//hit floor or roof
				if(this.y <= 0 || this.y >= 390)
					this.dY *= -1;

				this.x += this.dX;
				this.y += this.dY;
			})
			.bind("BallState", function(s) {
				this.attr({x:s.x, y:s.y, dX: s.dX, dY: s.dY});
			})
		}


		//Score boards
		Crafty.e("LeftPaddle, DOM, 2D, Text")
			.attr({ x: 20, y: 20, w: 100, h: 20, points: 0})
			.text("0 Points")
			.bind("LeftPointState", function(s) {
				this.text(s.points + " Points")
			});
		Crafty.e("RightPaddle, DOM, 2D, Text")
			.attr({ x: 580, y: 20, w: 100, h: 20, points: 0})
			.text("0 Points")
			.bind("RightPointState", function(s) {
				this.text(s.points + " Points")
			});
	});


}