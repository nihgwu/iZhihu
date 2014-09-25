## [iZhihu](http://youzhihu.com)

Zhihudaily powered by Node.js

Check out [my blogs](http://liteneo.com/tags/%E7%88%B1%E7%9F%A5%E4%B9%8E/) for more details

How to deploy

``` bash
# clone from git
$ git clone https://github.com/nihgwu/iZhihu.git

# install dependencies
$ cd iZhihu && npm install

# edit config.js, replace 'cnd' and 'qiniu' sections with your own config

# change the 'endDate' in lib/crawler.js to '20130520' to crawl all data 
# or the day before today for test

# start server
$ node app
```

## License

This project is released under the terms of the [GNU GPL v3](http://www.gnu.org/licenses/gpl.html)
