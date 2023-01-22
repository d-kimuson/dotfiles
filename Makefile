target := ".zshrc" ".commandsrc" ".localrc" ".gitconfig" ".czrc" ".gitconfig-mfac" "environment"

setup:
	make link

pull:
	git pull origin master

relink:
	make unlink
	make link

link:
	for item in $(target); do\
		ln -sf ~/dotfiles/$${item} ~/$${item};\
	done

unlink:
	for item in $(target); do\
		unlink ~/$${item};\
	done
