"use strict";
/*
Railroad Diagrams
by Tab Atkins Jr. (and others)
http://xanthir.com
http://twitter.com/tabatkins
http://github.com/tabatkins/railroad-diagrams

This document and all associated files in the github project are licensed under CC0: http://creativecommons.org/publicdomain/zero/1.0/
This means you can reuse, remix, or otherwise appropriate this project for your own use WITHOUT RESTRICTION.
(The actual legal meaning can be found at the above link.)
Don't ask me for permission to use any part of this project, JUST USE IT.
I would appreciate attribution, but that is not required by the license.
*/

// Export function versions of all the constructors.
// Each class will add itself to this object.
const funcs = {};
export default funcs;

export const Options = {
	DEBUG: false, // if true, writes some debug information into attributes
	VS: 8, // minimum vertical separation between things
	AR: 10, // radius of arcs
	DIAGRAM_CLASS: 'railroad-diagram', // class to put on the root <svg>
	STROKE_ODD_PIXEL_LENGTH: true, // is the stroke width an odd (1px, 3px, etc) pixel length?
	INTERNAL_ALIGNMENT: 'center', // how to align items when they have extra space. left/right/center
};


class FakeSVG {
	constructor(tagName, attrs, text) {
		if(text) this.children = text;
		else this.children = [];
		this.tagName = tagName;
		this.attrs = unnull(attrs, {});
	};
	format(x, y, width) {
		// Virtual
	};
	addTo(parent) {
		if(parent instanceof FakeSVG) {
			parent.children.push(this);
			return this;
		} else {
			var svg = this.toSVG();
			parent.appendChild(svg);
			return svg;
		}
	};
	toSVG() {
		var el = SVG(this.tagName, this.attrs);
		if(typeof this.children == 'string') {
			el.textContent = this.children;
		} else {
			this.children.forEach(function(e) {
				el.appendChild(e.toSVG());
			});
		}
		return el;
	};
	toString() {
		var str = '<' + this.tagName;
		var group = this.tagName == "g" || this.tagName == "svg";
		for(var attr in this.attrs) {
			str += ' ' + attr + '="' + (this.attrs[attr]+'').replace(/&/g, '&amp;').replace(/"/g, '&quot;') + '"';
		}
		str += '>';
		if(group) str += "\n";
		if(typeof this.children == 'string') {
			str += escapeString(this.children);
		} else {
			this.children.forEach(function(e) {
				str += e;
			});
		}
		str += '</' + this.tagName + '>\n';
		return str;
	}
}


class Path extends FakeSVG {
	constructor(x,y) {
		super('path');
		this.attrs.d = "M"+x+' '+y;
	}
	m(x,y) {
		this.attrs.d += 'm'+x+' '+y;
		return this;
	}
	h(val) {
		this.attrs.d += 'h'+val;
		return this;
	}
	right(val) { return this.h(Math.max(0, val)); }
	left(val) { return this.h(-Math.max(0, val)); }
	v(val) {
		this.attrs.d += 'v'+val;
		return this;
	}
	down(val) { return this.v(Math.max(0, val)); }
	up(val) { return this.v(-Math.max(0, val)); }
	arc(sweep){
		// 1/4 of a circle
		var x = Options.AR;
		var y = Options.AR;
		if(sweep[0] == 'e' || sweep[1] == 'w') {
			x *= -1;
		}
		if(sweep[0] == 's' || sweep[1] == 'n') {
			y *= -1;
		}
		if(sweep == 'ne' || sweep == 'es' || sweep == 'sw' || sweep == 'wn') {
			var cw = 1;
		} else {
			var cw = 0;
		}
		this.attrs.d += "a"+Options.AR+" "+Options.AR+" 0 0 "+cw+' '+x+' '+y;
		return this;
	}
	arc_8(start, dir) {
		// 1/8 of a circle
		const arc = Options.AR;
		const s2 = 1/Math.sqrt(2) * arc;
		const s2inv = (arc - s2);
		let path = "a " + arc + " " + arc + " 0 0 " + (dir=='cw' ? "1" : "0") + " ";
		const sd = start+dir;
		const offset =
			sd == 'ncw'   ? [s2, s2inv] :
			sd == 'necw'  ? [s2inv, s2] :
			sd == 'ecw'   ? [-s2inv, s2] :
			sd == 'secw'  ? [-s2, s2inv] :
			sd == 'scw'   ? [-s2, -s2inv] :
			sd == 'swcw'  ? [-s2inv, -s2] :
			sd == 'wcw'   ? [s2inv, -s2] :
			sd == 'nwcw'  ? [s2, -s2inv] :
			sd == 'nccw'  ? [-s2, s2inv] :
			sd == 'nwccw' ? [-s2inv, s2] :
			sd == 'wccw'  ? [s2inv, s2] :
			sd == 'swccw' ? [s2, s2inv] :
			sd == 'sccw'  ? [s2, -s2inv] :
			sd == 'seccw' ? [s2inv, -s2] :
			sd == 'eccw'  ? [-s2inv, -s2] :
			sd == 'neccw' ? [-s2, -s2inv] : null
		;
		path += offset.join(" ");
		this.attrs.d += path;
		return this;
	}
	l(x, y) {
		this.attrs.d += 'l'+x+' '+y;
		return this;
	}
	format() {
		// All paths in this library start/end horizontally.
		// The extra .5 ensures a minor overlap, so there's no seams in bad rasterizers.
		this.attrs.d += 'h.5';
		return this;
	}
}


export class Diagram extends FakeSVG {
	constructor(...items) {
		super('svg', {class: Options.DIAGRAM_CLASS});
		this.items = items.map(wrapString);
		this.items.unshift(new Start);
		this.items.push(new End);
		this.up = this.down = this.height = this.width = 0;
		for(const item of this.items) {
			this.width += item.width + (item.needsSpace?20:0);
			this.up = Math.max(this.up, item.up - this.height);
			this.height += item.height;
			this.down = Math.max(this.down - item.height, item.down);
		}
		this.formatted = false;
	}
	format(paddingt, paddingr, paddingb, paddingl) {
		paddingt = unnull(paddingt, 20);
		paddingr = unnull(paddingr, paddingt, 20);
		paddingb = unnull(paddingb, paddingt, 20);
		paddingl = unnull(paddingl, paddingr, 20);
		var x = paddingl;
		var y = paddingt;
		y += this.up;
		var g = new FakeSVG('g', Options.STROKE_ODD_PIXEL_LENGTH ? {transform:'translate(.5 .5)'} : {});
		for(var i = 0; i < this.items.length; i++) {
			var item = this.items[i];
			if(item.needsSpace) {
				new Path(x,y).h(10).addTo(g);
				x += 10;
			}
			item.format(x, y, item.width).addTo(g);
			x += item.width;
			y += item.height;
			if(item.needsSpace) {
				new Path(x,y).h(10).addTo(g);
				x += 10;
			}
		}
		this.attrs.width = this.width + paddingl + paddingr;
		this.attrs.height = this.up + this.height + this.down + paddingt + paddingb;
		this.attrs.viewBox = "0 0 " + this.attrs.width + " " + this.attrs.height;
		g.addTo(this);
		this.formatted = true;
		return this;
	}
	addTo(parent) {
		if(!parent) {
			var scriptTag = document.getElementsByTagName('script');
			scriptTag = scriptTag[scriptTag.length - 1];
			parent = scriptTag.parentNode;
		}
		return super.addTo.call(this, parent);
	}
	toSVG() {
		if (!this.formatted) {
			this.format();
		}
		return super.toSVG.call(this);
	}
	toString() {
		if (!this.formatted) {
			this.format();
		}
		return super.toString.call(this);
	}
}
funcs.Diagram = (...args)=>new Diagram(...args);


export class ComplexDiagram extends FakeSVG {
	constructor(...items) {
		var diagram = new Diagram(...items);
		diagram.items[0] = new Start("complex");
		diagram.items[diagram.items.length-1] = new End("complex");
		return diagram;
	}
}
funcs.ComplexDiagram = (...args)=>new ComplexDiagram(...args);


export class Sequence extends FakeSVG {
	constructor(...items) {
		super('g');
		this.items = items.map(wrapString);
		var numberOfItems = this.items.length;
		this.needsSpace = true;
		this.up = this.down = this.height = this.width = 0;
		for(var i = 0; i < this.items.length; i++) {
			var item = this.items[i];
			this.width += item.width + (item.needsSpace?20:0);
			this.up = Math.max(this.up, item.up - this.height);
			this.height += item.height;
			this.down = Math.max(this.down - item.height, item.down);
		}
		if(this.items[0].needsSpace) this.width -= 10;
		if(this.items[this.items.length-1].needsSpace) this.width -= 10;
		if(Options.DEBUG) {
			this.attrs['data-updown'] = this.up + " " + this.height + " " + this.down
			this.attrs['data-type'] = "sequence"
		}
	}
	format(x,y,width) {
		// Hook up the two sides if this is narrower than its stated width.
		var gaps = determineGaps(width, this.width);
		new Path(x,y).h(gaps[0]).addTo(this);
		new Path(x+gaps[0]+this.width,y+this.height).h(gaps[1]).addTo(this);
		x += gaps[0];

		for(var i = 0; i < this.items.length; i++) {
			var item = this.items[i];
			if(item.needsSpace && i > 0) {
				new Path(x,y).h(10).addTo(this);
				x += 10;
			}
			item.format(x, y, item.width).addTo(this);
			x += item.width;
			y += item.height;
			if(item.needsSpace && i < this.items.length-1) {
				new Path(x,y).h(10).addTo(this);
				x += 10;
			}
		}
		return this;
	}
}
funcs.Sequence = (...args)=>new Sequence(...args);


export class Stack extends FakeSVG {
	constructor(...items) {
		super('g');
		if( items.length === 0 ) {
			throw new RangeError("Stack() must have at least one child.");
		}
		this.items = items.map(wrapString);
		this.width = Math.max.apply(null, this.items.map(function(e) { return e.width + (e.needsSpace?20:0); }));
		//if(this.items[0].needsSpace) this.width -= 10;
		//if(this.items[this.items.length-1].needsSpace) this.width -= 10;
		if(this.items.length > 1){
			this.width += Options.AR*2;
		}
		this.needsSpace = true;
		this.up = this.items[0].up;
		this.down = this.items[this.items.length-1].down;

		this.height = 0;
		var last = this.items.length - 1;
		for(var i = 0; i < this.items.length; i++) {
			var item = this.items[i];
			this.height += item.height;
			if(i > 0) {
				this.height += Math.max(Options.AR*2, item.up + Options.VS);
			}
			if(i < last) {
				this.height += Math.max(Options.AR*2, item.down + Options.VS);
			}
		}
		if(Options.DEBUG) {
			this.attrs['data-updown'] = this.up + " " + this.height + " " + this.down
			this.attrs['data-type'] = "stack"
		}
	}
	format(x,y,width) {
		var gaps = determineGaps(width, this.width);
		new Path(x,y).h(gaps[0]).addTo(this);
		x += gaps[0];
		var xInitial = x;
		if(this.items.length > 1) {
			new Path(x, y).h(Options.AR).addTo(this);
			x += Options.AR;
		}

		for(var i = 0; i < this.items.length; i++) {
			var item = this.items[i];
			var innerWidth = this.width - (this.items.length>1 ? Options.AR*2 : 0);
			item.format(x, y, innerWidth).addTo(this);
			x += innerWidth;
			y += item.height;

			if(i !== this.items.length-1) {
				new Path(x, y)
					.arc('ne').down(Math.max(0, item.down + Options.VS - Options.AR*2))
					.arc('es').left(innerWidth)
					.arc('nw').down(Math.max(0, this.items[i+1].up + Options.VS - Options.AR*2))
					.arc('ws').addTo(this);
				y += Math.max(item.down + Options.VS, Options.AR*2) + Math.max(this.items[i+1].up + Options.VS, Options.AR*2);
				//y += Math.max(Options.AR*4, item.down + Options.VS*2 + this.items[i+1].up)
				x = xInitial+Options.AR;
			}

		}

		if(this.items.length > 1) {
			new Path(x,y).h(Options.AR).addTo(this);
			x += Options.AR;
		}
		new Path(x,y).h(gaps[1]).addTo(this);

		return this;
	}
}
funcs.Stack = (...args)=>new Stack(...args);


export class OptionalSequence extends FakeSVG {
	constructor(...items) {
		super('g');
		if( items.length === 0 ) {
			throw new RangeError("OptionalSequence() must have at least one child.");
		}
		if( items.length === 1 ) {
			return new Sequence(items);
		}
		var arc = Options.AR;
		this.items = items.map(wrapString);
		this.needsSpace = false;
		this.width = 0;
		this.up = 0;
		this.height = sum(this.items, function(x){return x.height});
		this.down = this.items[0].down;
		var heightSoFar = 0;
		for(var i = 0; i < this.items.length; i++) {
			var item = this.items[i];
			this.up = Math.max(this.up, Math.max(arc*2, item.up + Options.VS) - heightSoFar);
			heightSoFar += item.height;
			if(i > 0) {
				this.down = Math.max(this.height + this.down, heightSoFar + Math.max(arc*2, item.down + Options.VS)) - this.height;
			}
			var itemWidth = (item.needsSpace?10:0) + item.width;
			if(i == 0) {
				this.width += arc + Math.max(itemWidth, arc);
			} else {
				this.width += arc*2 + Math.max(itemWidth, arc) + arc;
			}
		}
		if(Options.DEBUG) {
			this.attrs['data-updown'] = this.up + " " + this.height + " " + this.down
			this.attrs['data-type'] = "optseq"
		}
	}
	format(x, y, width) {
		var arc = Options.AR;
		var gaps = determineGaps(width, this.width);
		new Path(x, y).right(gaps[0]).addTo(this);
		new Path(x + gaps[0] + this.width, y + this.height).right(gaps[1]).addTo(this);
		x += gaps[0]
		var upperLineY = y - this.up;
		var last = this.items.length - 1;
		for(var i = 0; i < this.items.length; i++) {
			var item = this.items[i];
			var itemSpace = (item.needsSpace?10:0);
			var itemWidth = item.width + itemSpace;
			if(i == 0) {
				// Upper skip
				new Path(x,y)
					.arc('se')
					.up(y - upperLineY - arc*2)
					.arc('wn')
					.right(itemWidth - arc)
					.arc('ne')
					.down(y + item.height - upperLineY - arc*2)
					.arc('ws')
					.addTo(this);
				// Straight line
				new Path(x, y)
					.right(itemSpace + arc)
					.addTo(this);
				item.format(x + itemSpace + arc, y, item.width).addTo(this);
				x += itemWidth + arc;
				y += item.height;
				// x ends on the far side of the first element,
				// where the next element's skip needs to begin
			} else if(i < last) {
				// Upper skip
				new Path(x, upperLineY)
					.right(arc*2 + Math.max(itemWidth, arc) + arc)
					.arc('ne')
					.down(y - upperLineY + item.height - arc*2)
					.arc('ws')
					.addTo(this);
				// Straight line
				new Path(x,y)
					.right(arc*2)
					.addTo(this);
				item.format(x + arc*2, y, item.width).addTo(this);
				new Path(x + item.width + arc*2, y + item.height)
					.right(itemSpace + arc)
					.addTo(this);
				// Lower skip
				new Path(x,y)
					.arc('ne')
					.down(item.height + Math.max(item.down + Options.VS, arc*2) - arc*2)
					.arc('ws')
					.right(itemWidth - arc)
					.arc('se')
					.up(item.down + Options.VS - arc*2)
					.arc('wn')
					.addTo(this);
				x += arc*2 + Math.max(itemWidth, arc) + arc;
				y += item.height;
			} else {
				// Straight line
				new Path(x, y)
					.right(arc*2)
					.addTo(this);
				item.format(x + arc*2, y, item.width).addTo(this);
				new Path(x + arc*2 + item.width, y + item.height)
					.right(itemSpace + arc)
					.addTo(this);
				// Lower skip
				new Path(x,y)
					.arc('ne')
					.down(item.height + Math.max(item.down + Options.VS, arc*2) - arc*2)
					.arc('ws')
					.right(itemWidth - arc)
					.arc('se')
					.up(item.down + Options.VS - arc*2)
					.arc('wn')
					.addTo(this);
			}
		}
		return this;
	}
}
funcs.OptionalSequence = (...args)=>new OptionalSequence(...args);


export class AlternatingSequence extends FakeSVG {
	constructor(...items) {
		super('g');
		if( items.length === 1 ) {
			return new Sequence(items);
		}
		if( items.length !== 2 ) {
			throw new RangeError("AlternatingSequence() must have one or two children.");
		}
		this.items = items.map(wrapString);
		this.needsSpace = false;

		const arc = Options.AR;
		const vert = Options.VS;
		const max = Math.max;
		const first = this.items[0];
		const second = this.items[1];

		const arcX = 1 / Math.sqrt(2) * arc * 2;
		const arcY = (1 - 1 / Math.sqrt(2)) * arc * 2;
		const crossY = Math.max(arc, Options.VS);
		const crossX = (crossY - arcY) + arcX;

		const firstOut = max(arc + arc, crossY/2 + arc + arc, crossY/2 + vert + first.down);
		this.up = firstOut + first.height + first.up;

		const secondIn = max(arc + arc, crossY/2 + arc + arc, crossY/2 + vert + second.up);
		this.down = secondIn + second.height + second.down;

		this.height = 0;

		const firstWidth = 2*(first.needsSpace?10:0) + first.width;
		const secondWidth = 2*(second.needsSpace?10:0) + second.width;
		this.width = 2*arc + max(firstWidth, crossX, secondWidth) + 2*arc;

		if(Options.DEBUG) {
			this.attrs['data-updown'] = this.up + " " + this.height + " " + this.down
			this.attrs['data-type'] = "altseq"
		}
	}
	format(x, y, width) {
		const arc = Options.AR;
		const gaps = determineGaps(width, this.width);
		new Path(x,y).right(gaps[0]).addTo(this);
		console.log(gaps);
		x += gaps[0];
		new Path(x+this.width, y).right(gaps[1]).addTo(this);
		// bounding box
		//new Path(x+gaps[0], y).up(this.up).right(this.width).down(this.up+this.down).left(this.width).up(this.down).addTo(this);
		const first = this.items[0];
		const second = this.items[1];

		// top
		const firstIn = this.up - first.up;
		const firstOut = this.up - first.up - first.height;
		new Path(x,y).arc('se').up(firstIn-2*arc).arc('wn').addTo(this);
		first.format(x + 2*arc, y - firstIn, this.width - 4*arc).addTo(this);
		new Path(x + this.width - 2*arc, y - firstOut).arc('ne').down(firstOut - 2*arc).arc('ws').addTo(this);

		// bottom
		const secondIn = this.down - second.down - second.height;
		const secondOut = this.down - second.down;
		new Path(x,y).arc('ne').down(secondIn - 2*arc).arc('ws').addTo(this);
		second.format(x + 2*arc, y + secondIn, this.width - 4*arc).addTo(this);
		new Path(x + this.width - 2*arc, y + secondOut).arc('se').up(secondOut - 2*arc).arc('wn').addTo(this);

		// crossover
		const arcX = 1 / Math.sqrt(2) * arc * 2;
		const arcY = (1 - 1 / Math.sqrt(2)) * arc * 2;
		const crossY = Math.max(arc, Options.VS);
		const crossX = (crossY - arcY) + arcX;
		const crossBar = (this.width - 4*arc - crossX)/2;
		new Path(x+arc, y - crossY/2 - arc).arc('ws').right(crossBar)
			.arc_8('n', 'cw').l(crossX - arcX, crossY - arcY).arc_8('sw', 'ccw')
			.right(crossBar).arc('ne').addTo(this);
		new Path(x+arc, y + crossY/2 + arc).arc('wn').right(crossBar)
			.arc_8('s', 'ccw').l(crossX - arcX, -(crossY - arcY)).arc_8('nw', 'cw')
			.right(crossBar).arc('se').addTo(this);

		return this;
	}
}
funcs.AlternatingSequence = (...args)=>new AlternatingSequence(...args);


export class Choice extends FakeSVG {
	constructor(normal, ...items) {
		super('g');
		if( typeof normal !== "number" || normal !== Math.floor(normal) ) {
			throw new TypeError("The first argument of Choice() must be an integer.");
		} else if(normal < 0 || normal >= items.length) {
			throw new RangeError("The first argument of Choice() must be an index for one of the items.");
		} else {
			this.normal = normal;
		}
		var first = 0;
		var last = items.length - 1;
		this.items = items.map(wrapString);
		this.width = Math.max.apply(null, this.items.map(function(el){return el.width})) + Options.AR*4;
		this.height = this.items[normal].height;
		this.up = this.items[first].up;
		for(var i = first; i < normal; i++) {
			if(i == normal-1) var arcs = Options.AR*2;
			else var arcs = Options.AR;
			this.up += Math.max(arcs, this.items[i].height + this.items[i].down + Options.VS + this.items[i+1].up);
		}
		this.down = this.items[last].down;
		for(var i = normal+1; i <= last; i++) {
			if(i == normal+1) var arcs = Options.AR*2;
			else var arcs = Options.AR;
			this.down += Math.max(arcs, this.items[i-1].height + this.items[i-1].down + Options.VS + this.items[i].up);
		}
		this.down -= this.items[normal].height; // already counted in Choice.height
		if(Options.DEBUG) {
			this.attrs['data-updown'] = this.up + " " + this.height + " " + this.down
			this.attrs['data-type'] = "choice"
		}
	}
	format(x,y,width) {
		// Hook up the two sides if this is narrower than its stated width.
		var gaps = determineGaps(width, this.width);
		new Path(x,y).h(gaps[0]).addTo(this);
		new Path(x+gaps[0]+this.width,y+this.height).h(gaps[1]).addTo(this);
		x += gaps[0];

		var last = this.items.length -1;
		var innerWidth = this.width - Options.AR*4;

		// Do the elements that curve above
		for(var i = this.normal - 1; i >= 0; i--) {
			var item = this.items[i];
			if( i == this.normal - 1 ) {
				var distanceFromY = Math.max(Options.AR*2, this.items[this.normal].up + Options.VS + item.down + item.height);
			}
			new Path(x,y)
				.arc('se')
				.up(distanceFromY - Options.AR*2)
				.arc('wn').addTo(this);
			item.format(x+Options.AR*2,y - distanceFromY,innerWidth).addTo(this);
			new Path(x+Options.AR*2+innerWidth, y-distanceFromY+item.height)
				.arc('ne')
				.down(distanceFromY - item.height + this.height - Options.AR*2)
				.arc('ws').addTo(this);
			distanceFromY += Math.max(Options.AR, item.up + Options.VS + (i == 0 ? 0 : this.items[i-1].down+this.items[i-1].height));
		}

		// Do the straight-line path.
		new Path(x,y).right(Options.AR*2).addTo(this);
		this.items[this.normal].format(x+Options.AR*2, y, innerWidth).addTo(this);
		new Path(x+Options.AR*2+innerWidth, y+this.height).right(Options.AR*2).addTo(this);

		// Do the elements that curve below
		for(var i = this.normal+1; i <= last; i++) {
			var item = this.items[i];
			if( i == this.normal + 1 ) {
				var distanceFromY = Math.max(Options.AR*2, this.height + this.items[this.normal].down + Options.VS + item.up);
			}
			new Path(x,y)
				.arc('ne')
				.down(distanceFromY - Options.AR*2)
				.arc('ws').addTo(this);
			item.format(x+Options.AR*2, y+distanceFromY, innerWidth).addTo(this);
			new Path(x+Options.AR*2+innerWidth, y+distanceFromY+item.height)
				.arc('se')
				.up(distanceFromY - Options.AR*2 + item.height - this.height)
				.arc('wn').addTo(this);
			distanceFromY += Math.max(Options.AR, item.height + item.down + Options.VS + (i == last ? 0 : this.items[i+1].up));
		}

		return this;
	}
}
funcs.Choice = (...args)=>new Choice(...args);


export class MultipleChoice extends FakeSVG {
	constructor(normal, type, ...items) {
		super('g');
		if( typeof normal !== "number" || normal !== Math.floor(normal) ) {
			throw new TypeError("The first argument of MultipleChoice() must be an integer.");
		} else if(normal < 0 || normal >= items.length) {
			throw new RangeError("The first argument of MultipleChoice() must be an index for one of the items.");
		} else {
			this.normal = normal;
		}
		if( type != "any" && type != "all" ) {
			throw new SyntaxError("The second argument of MultipleChoice must be 'any' or 'all'.");
		} else {
			this.type = type;
		}
		this.needsSpace = true;
		this.items = items.map(wrapString);
		this.innerWidth = max(this.items, function(x){return x.width});
		this.width = 30 + Options.AR + this.innerWidth + Options.AR + 20;
		this.up = this.items[0].up;
		this.down = this.items[this.items.length-1].down;
		this.height = this.items[normal].height;
		for(var i = 0; i < this.items.length; i++) {
			var item = this.items[i];
			if(i == normal - 1 || i == normal + 1) var minimum = 10 + Options.AR;
			else var minimum = Options.AR;
			if(i < normal) {
				this.up += Math.max(minimum, item.height + item.down + Options.VS + this.items[i+1].up);
			} else if(i > normal) {
				this.down += Math.max(minimum, item.up + Options.VS + this.items[i-1].down + this.items[i-1].height);
			}
		}
		this.down -= this.items[normal].height; // already counted in this.height
		if(Options.DEBUG) {
			this.attrs['data-updown'] = this.up + " " + this.height + " " + this.down
			this.attrs['data-type'] = "multiplechoice"
		}
	}
	format(x, y, width) {
		var gaps = determineGaps(width, this.width);
		new Path(x, y).right(gaps[0]).addTo(this);
		new Path(x + gaps[0] + this.width, y + this.height).right(gaps[1]).addTo(this);
		x += gaps[0];

		var normal = this.items[this.normal];

		// Do the elements that curve above
		for(var i = this.normal - 1; i >= 0; i--) {
			var item = this.items[i];
			if( i == this.normal - 1 ) {
				var distanceFromY = Math.max(10 + Options.AR, normal.up + Options.VS + item.down + item.height);
			}
			new Path(x + 30,y)
				.up(distanceFromY - Options.AR)
				.arc('wn').addTo(this);
			item.format(x + 30 + Options.AR, y - distanceFromY, this.innerWidth).addTo(this);
			new Path(x + 30 + Options.AR + this.innerWidth, y - distanceFromY + item.height)
				.arc('ne')
				.down(distanceFromY - item.height + this.height - Options.AR - 10)
				.addTo(this);
			if(i != 0) {
				distanceFromY += Math.max(Options.AR, item.up + Options.VS + this.items[i-1].down + this.items[i-1].height);
			}
		}

		new Path(x + 30, y).right(Options.AR).addTo(this);
		normal.format(x + 30 + Options.AR, y, this.innerWidth).addTo(this);
		new Path(x + 30 + Options.AR + this.innerWidth, y + this.height).right(Options.AR).addTo(this);

		for(var i = this.normal+1; i < this.items.length; i++) {
			var item = this.items[i];
			if(i == this.normal + 1) {
				var distanceFromY = Math.max(10+Options.AR, normal.height + normal.down + Options.VS + item.up);
			}
			new Path(x + 30, y)
				.down(distanceFromY - Options.AR)
				.arc('ws')
				.addTo(this);
			item.format(x + 30 + Options.AR, y + distanceFromY, this.innerWidth).addTo(this)
			new Path(x + 30 + Options.AR + this.innerWidth, y + distanceFromY + item.height)
				.arc('se')
				.up(distanceFromY - Options.AR + item.height - normal.height)
				.addTo(this);
			if(i != this.items.length - 1) {
				distanceFromY += Math.max(Options.AR, item.height + item.down + Options.VS + this.items[i+1].up);
			}
		}
		var text = new FakeSVG('g', {"class": "diagram-text"}).addTo(this)
		new FakeSVG('title', {}, (this.type=="any"?"take one or more branches, once each, in any order":"take all branches, once each, in any order")).addTo(text)
		new FakeSVG('path', {
			"d": "M "+(x+30)+" "+(y-10)+" h -26 a 4 4 0 0 0 -4 4 v 12 a 4 4 0 0 0 4 4 h 26 z",
			"class": "diagram-text"
			}).addTo(text)
		new FakeSVG('text', {
			"x": x + 15,
			"y": y + 4,
			"class": "diagram-text"
			}, (this.type=="any"?"1+":"all")).addTo(text)
		new FakeSVG('path', {
			"d": "M "+(x+this.width-20)+" "+(y-10)+" h 16 a 4 4 0 0 1 4 4 v 12 a 4 4 0 0 1 -4 4 h -16 z",
			"class": "diagram-text"
			}).addTo(text)
		new FakeSVG('path', {
			"d": "M "+(x+this.width-13)+" "+(y-2)+" a 4 4 0 1 0 6 -1 m 2.75 -1 h -4 v 4 m 0 -3 h 2",
			"style": "stroke-width: 1.75"
		}).addTo(text)
		return this;
	}
}
funcs.MultipleChoice = (...args)=>new MultipleChoice(...args);


export class Optional extends FakeSVG {
	constructor(item, skip) {
		if( skip === undefined )
			return Choice(1, Skip(), item);
		else if ( skip === "skip" )
			return Choice(0, Skip(), item);
		else
			throw "Unknown value for Optional()'s 'skip' argument.";
	}
}
funcs.Optional = (...args)=>new Optional(...args);


export class OneOrMore extends FakeSVG {
	constructor(item, rep) {
		super('g');
		rep = rep || (new Skip);
		this.item = wrapString(item);
		this.rep = wrapString(rep);
		this.width = Math.max(this.item.width, this.rep.width) + Options.AR*2;
		this.height = this.item.height;
		this.up = this.item.up;
		this.down = Math.max(Options.AR*2, this.item.down + Options.VS + this.rep.up + this.rep.height + this.rep.down);
		this.needsSpace = true;
		if(Options.DEBUG) {
			this.attrs['data-updown'] = this.up + " " + this.height + " " + this.down
			this.attrs['data-type'] = "oneormore"
		}
	}
	format(x,y,width) {
		// Hook up the two sides if this is narrower than its stated width.
		var gaps = determineGaps(width, this.width);
		new Path(x,y).h(gaps[0]).addTo(this);
		new Path(x+gaps[0]+this.width,y+this.height).h(gaps[1]).addTo(this);
		x += gaps[0];

		// Draw item
		new Path(x,y).right(Options.AR).addTo(this);
		this.item.format(x+Options.AR,y,this.width-Options.AR*2).addTo(this);
		new Path(x+this.width-Options.AR,y+this.height).right(Options.AR).addTo(this);

		// Draw repeat arc
		var distanceFromY = Math.max(Options.AR*2, this.item.height+this.item.down+Options.VS+this.rep.up);
		new Path(x+Options.AR,y).arc('nw').down(distanceFromY-Options.AR*2).arc('ws').addTo(this);
		this.rep.format(x+Options.AR, y+distanceFromY, this.width - Options.AR*2).addTo(this);
		new Path(x+this.width-Options.AR, y+distanceFromY+this.rep.height).arc('se').up(distanceFromY-Options.AR*2+this.rep.height-this.item.height).arc('en').addTo(this);

		return this;
	}
}
funcs.OneOrMore = (...args)=>new OneOrMore(...args);


export class ZeroOrMore extends FakeSVG {
	constructor(item, rep, skip) {
		return Optional(OneOrMore(item, rep), skip);
	}
}
funcs.ZeroOrMore = (...args)=>new ZeroOrMore(...args);


export class Start extends FakeSVG {
	constructor(type) {
		super('path');
		this.width = 20;
		this.height = 0;
		this.up = 10;
		this.down = 10;
		this.type = type || "simple";
		if(Options.DEBUG) {
			this.attrs['data-updown'] = this.up + " " + this.height + " " + this.down
			this.attrs['data-type'] = "start"
		}
	}
	format(x,y) {
		if (this.type === "complex") {
			this.attrs.d = 'M '+x+' '+(y-10)+' v 20 m 0 -10 h 20.5';
		} else {
			this.attrs.d = 'M '+x+' '+(y-10)+' v 20 m 10 -20 v 20 m -10 -10 h 20.5';
		}
		return this;
	}
}
funcs.Start = (...args)=>new Start(...args);


export class End extends FakeSVG {
	constructor(type) {
		super('path');
		this.width = 20;
		this.height = 0;
		this.up = 10;
		this.down = 10;
		this.type = type || "simple";
		if(Options.DEBUG) {
			this.attrs['data-updown'] = this.up + " " + this.height + " " + this.down
			this.attrs['data-type'] = "end"
		}
	}
	format(x,y) {
		if (this.type === "complex") {
			this.attrs.d = 'M '+x+' '+y+' h 20 m 0 -10 v 20';
		} else {
			this.attrs.d = 'M '+x+' '+y+' h 20 m -10 -10 v 20 m 10 -20 v 20';
		}
		return this;
	}
}
funcs.End = (...args)=>new End(...args);


export class Terminal extends FakeSVG {
	constructor(text, href) {
		super('g', {'class': 'terminal'});
		this.text = text;
		this.href = href;
		this.width = text.length * 8 + 20; /* Assume that each char is .5em, and that the em is 16px */
		this.height = 0;
		this.up = 11;
		this.down = 11;
		this.needsSpace = true;
		if(Options.DEBUG) {
			this.attrs['data-updown'] = this.up + " " + this.height + " " + this.down
			this.attrs['data-type'] = "terminal"
		}
	}
	format(x, y, width) {
		// Hook up the two sides if this is narrower than its stated width.
		var gaps = determineGaps(width, this.width);
		new Path(x,y).h(gaps[0]).addTo(this);
		new Path(x+gaps[0]+this.width,y).h(gaps[1]).addTo(this);
		x += gaps[0];

		new FakeSVG('rect', {x:x, y:y-11, width:this.width, height:this.up+this.down, rx:10, ry:10}).addTo(this);
		var text = new FakeSVG('text', {x:x+this.width/2, y:y+4}, this.text);
		if(this.href)
			new FakeSVG('a', {'xlink:href': this.href}, [text]).addTo(this);
		else
			text.addTo(this);
		return this;
	}
}
funcs.Terminal = (...args)=>new Terminal(...args);


export class NonTerminal extends FakeSVG {
	constructor(text, href) {
		super('g', {'class': 'non-terminal'});
		this.text = text;
		this.href = href;
		this.width = text.length * 8 + 20;
		this.height = 0;
		this.up = 11;
		this.down = 11;
		this.needsSpace = true;
		if(Options.DEBUG) {
			this.attrs['data-updown'] = this.up + " " + this.height + " " + this.down
			this.attrs['data-type'] = "nonterminal"
		}
	}
	format(x, y, width) {
		// Hook up the two sides if this is narrower than its stated width.
		var gaps = determineGaps(width, this.width);
		new Path(x,y).h(gaps[0]).addTo(this);
		new Path(x+gaps[0]+this.width,y).h(gaps[1]).addTo(this);
		x += gaps[0];

		new FakeSVG('rect', {x:x, y:y-11, width:this.width, height:this.up+this.down}).addTo(this);
		var text = new FakeSVG('text', {x:x+this.width/2, y:y+4}, this.text);
		if(this.href)
			new FakeSVG('a', {'xlink:href': this.href}, [text]).addTo(this);
		else
			text.addTo(this);
		return this;
	}
}
funcs.NonTerminal = (...args)=>new NonTerminal(...args);


export class Comment extends FakeSVG {
	constructor(text, href) {
		super('g');
		this.text = text;
		this.href = href;
		this.width = text.length * 7 + 10;
		this.height = 0;
		this.up = 11;
		this.down = 11;
		this.needsSpace = true;
		if(Options.DEBUG) {
			this.attrs['data-updown'] = this.up + " " + this.height + " " + this.down
			this.attrs['data-type'] = "comment"
		}
	}
	format(x, y, width) {
		// Hook up the two sides if this is narrower than its stated width.
		var gaps = determineGaps(width, this.width);
		new Path(x,y).h(gaps[0]).addTo(this);
		new Path(x+gaps[0]+this.width,y+this.height).h(gaps[1]).addTo(this);
		x += gaps[0];

		var text = new FakeSVG('text', {x:x+this.width/2, y:y+5, class:'comment'}, this.text);
		if(this.href)
			new FakeSVG('a', {'xlink:href': this.href}, [text]).addTo(this);
		else
			text.addTo(this);
		return this;
	}
}
funcs.Comment = (...args)=>new Comment(...args);


export class Skip extends FakeSVG {
	constructor() {
		super('g');
		this.width = 0;
		this.height = 0;
		this.up = 0;
		this.down = 0;
		this.needsSpace = false
		if(Options.DEBUG) {
			this.attrs['data-updown'] = this.up + " " + this.height + " " + this.down
			this.attrs['data-type'] = "skip"
		}
	}
	format(x, y, width) {
		new Path(x,y).right(width).addTo(this);
		return this;
	}
}
funcs.Skip = (...args)=>new Skip(...args);


function unnull(...args) {
	// Return the first value that isn't undefined.
	// More correct than `v1 || v2 || v3` because falsey values will be returned.
	return args.reduce(function(sofar, x) { return sofar !== undefined ? sofar : x; });
}

function determineGaps(outer, inner) {
	var diff = outer - inner;
	switch(Options.INTERNAL_ALIGNMENT) {
		case 'left': return [0, diff]; break;
		case 'right': return [diff, 0]; break;
		case 'center':
		default: return [diff/2, diff/2]; break;
	}
}

function wrapString(value) {
	return ((typeof value) == 'string') ? new Terminal(value) : value;
}

function sum(iter, func) {
	if(!func) func = function(x) { return x; };
	return iter.map(func).reduce(function(a,b){return a+b}, 0);
}

function max(iter, func) {
	if(!func) func = function(x) { return x; };
	return Math.max.apply(null, iter.map(func));
}

function SVG(name, attrs, text) {
	attrs = attrs || {};
	text = text || '';
	var el = document.createElementNS("http://www.w3.org/2000/svg",name);
	for(var attr in attrs) {
		if(attr === 'xlink:href')
			el.setAttributeNS("http://www.w3.org/1999/xlink", 'href', attrs[attr]);
		else
			el.setAttribute(attr, attrs[attr]);
	}
	el.textContent = text;
	return el;
}

function escapeString(string) {
	// Escape markdown and HTML special characters
	return string.replace(/[*_\`\[\]<&]/g, function(charString) {
		return '&#' + charString.charCodeAt(0) + ';';
	});
};