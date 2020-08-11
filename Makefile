commands := git@gitlab.com:config-kimuemon/commands.git
target := ".zshrc" ".commandsrc" ".env_variables.secret" ".commands"

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

# link:
# 	ln -sf ~/dotfiles/.zshrc ~/.zshrc
# 	ln -sf ~/dotfiles/.commandsrc ~/.commandsrc
# 	ln -sf ~/dotfiles/.env_variables.secret ~/.env_variables.secret
# 	ln -sf ~/dotfiles/.commands ~/.commands

# unlink:
# 	unlink ~/.zshrc
# 	unlink ~/.commandsrc
# 	unlink ~/.commands
# 	unlink ~/.env_variables.secret
