add('comment', Diagram(
	'/*',
	ZeroOrMore(
		NonTerminal('anything but * followed by /')),
	'*/'));


add('newline', Diagram(Choice(0, '\\n', '\\r\\n', '\\r', '\\f')));

add('whitespace', Diagram(Choice(
	0, 'space', '\\t', NonTerminal('newline'))));