commands := git@gitlab.com:config-kimuemon/commands.git
target := ".zshrc" ".commandsrc" ".env_variable.secret" ".commands"

setup:
	git clone $(commands) .commands
	make link

pull:
	git pull origin master
	cd .commands && git pull origin master && cd ..

link:
	for item in $(target); do\
		ln -sf ~/dotfiles/$${item} ~/$${item};\
	done

unlink:
	for item in $(target); do\
		unlink ~/$${item};\
	done
