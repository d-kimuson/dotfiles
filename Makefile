commands := git@github.com:d-kimuson/commands.git
target := ".zshrc" ".commandsrc" ".localrc" ".commands"

setup:
	rm -rf .commands && git clone $(commands) .commands
	make link

pull:
	git pull origin master
	cd .commands && git pull origin master

link:
	make unlink
	for item in $(target); do\
		ln -sf ~/dotfiles/$${item} ~/$${item};\
	done

unlink:
	for item in $(target); do\
		unlink ~/$${item};\
	done
