target := ".zshrc" ".commandsrc" ".localrc" ".commands"

setup:
	make link

pull:
	git pull origin master

link:
	make unlink
	for item in $(target); do\
		ln -sf ~/dotfiles/$${item} ~/$${item};\
	done

unlink:
	for item in $(target); do\
		unlink ~/$${item};\
	done
