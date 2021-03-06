<?php
/**
 * This file is part of Jarves.
 *
 * (c) Marc J. Schmidt <marc@marcjschmidt.de>
 *
 *     J.A.R.V.E.S - Just A Rather Very Easy [content management] System.
 *
 *     http://jarves.io
 *
 * To get the full copyright and license information, please view the
 * LICENSE file, that was distributed with this source code.
 */

namespace Jarves;


use Jarves\AssetHandler\Container;
use Jarves\Cache\Cacher;
use Jarves\Model\Node;
use Symfony\Component\EventDispatcher\EventDispatcherInterface;
use Symfony\Component\Routing\Router;
use Symfony\Component\Templating\EngineInterface;

class PageResponseFactory
{
    /**
     * @var StopwatchHelper
     */
    private $stopwatch;

    /**
     * @var Container
     */
    private $assetCompilerContainer;

    /**
     * @var EventDispatcherInterface
     */
    private $eventDispatcher;

    /**
     * @var EngineInterface
     */
    private $templating;

    /**
     * @var EditMode
     */
    private $editMode;
    /**
     * @var Jarves
     */
    private $jarves;
    /**
     * @var PageStack
     */
    private $pageStack;
    /**
     * @var Router
     */
    private $router;
    /**
     * @var Cacher
     */
    private $cacher;

    /**
     * @param Jarves $jarves
     * @param PageStack $pageStack
     * @param StopwatchHelper $stopwatch
     * @param Container $assetCompilerContainer
     * @param EventDispatcherInterface $eventDispatcher
     * @param EngineInterface $templating
     * @param EditMode $editMode
     */
    public function __construct(Jarves $jarves, PageStack $pageStack, StopwatchHelper $stopwatch, Container $assetCompilerContainer,
                                EventDispatcherInterface $eventDispatcher, EngineInterface $templating,
                                EditMode $editMode, Router $router, Cacher $cacher)
    {
        $this->jarves = $jarves;
        $this->stopwatch = $stopwatch;
        $this->assetCompilerContainer = $assetCompilerContainer;
        $this->eventDispatcher = $eventDispatcher;
        $this->templating = $templating;
        $this->editMode = $editMode;
        $this->pageStack = $pageStack;
        $this->router = $router;
        $this->cacher = $cacher;
    }

    /**
     * @return PageResponse
     */
    public function create($data = '')
    {
        return new PageResponse(
            $data, 200, [],
            $this->pageStack, $this->jarves, $this->stopwatch, $this->assetCompilerContainer, $this->eventDispatcher, $this->templating, $this->editMode
        );
    }

    /**
     * Creates a new PageResponse object based on the current found route (using Symfony's router) or using $routeName.
     * If you've a theme then you could specify "theme" at the route options (to have a custom doctype/base template)
     *
     * @param string $template
     * @param array $parameters
     * @param null|string $routeName
     *
     * @return PageResponse
     */
    public function createFromRouteWithBody($template, $parameters = [], $routeName = null)
    {
        $pageResponse = $this->createFromRoute($routeName);

        $body = $this->templating->render($template, $parameters);
        $pageResponse->setBody($body);
        $pageResponse->setRenderFrontPage(false);

        return $pageResponse;
    }

    /**
     * Creates a new PageResponse object based on the current found route (using Symfony's router) or using $routeName.
     * You need to define at your routes additional options: title, theme, layout.
     *
     * @param null $routeName Per default current route name, if available
     * @param string|array|null $contents
     *
     * @return PageResponse
     */
    public function createFromRoute($routeName = null, $contents = null)
    {
        if (!$routeName) {
            $routeName = $this->pageStack->getRequest()->attributes->get('_route');
            if (!$routeName) {
                throw new \RuntimeException('Could not detect route name');
            }
        }

        $reflection = new \ReflectionClass($this->router->getGenerator());
        $key = 'jarves_routes';

        $cache = $this->cacher->getFastCache($key);
        $validCache = false;
        $routes = [];

        if ($cache) {
            $validCache = $cache['time'] === filemtime($reflection->getFileName()) && isset($cache['routes']) && is_string($cache['routes']);
            if ($validCache) {
                $routes = unserialize($cache['routes']);
            }
        }

        if (!$validCache) {
            $routes = $this->router->getRouteCollection()->all();
            $this->cacher->setFastCache($key, [
                'time' => filemtime($reflection->getFileName()),
                'routes' => serialize($routes)
            ]);
        }

        if (!isset($routes[$routeName])) {
            throw new \RuntimeException("Route with name `$routeName` does not exist");
        }

        $route = $routes[$routeName];
        $page = Node::createPage($route->getOption('title'), $route->getPath(), $route->getOption('theme'), $route->getOption('layout'));

        return $this->createWithPage($page, $contents);
    }

    /**
     * @param Node|string|int $page Node model, url or node id. Use Jarves\Model\Node::createPage()
     * @param string|array|null $contents
     *
     * @return PageResponse
     */
    public function createWithPage($page, $contents = null)
    {
        $page = $this->pageStack->getPage($page);

        if (!$page) {
            throw new \InvalidArgumentException('Can not find page.');
        }
        $this->pageStack->setCurrentPage($page);

        $pageResponse = new PageResponse(
            '', 200, [],
            $this->pageStack, $this->jarves, $this->stopwatch, $this->assetCompilerContainer, $this->eventDispatcher, $this->templating, $this->editMode
        );

        $this->pageStack->setPageResponse($pageResponse);

        if (null !== $contents) {
            $pageResponse->setPageContent($contents);
        }

        return $pageResponse;
    }

    /**
     * @return PageResponse
     */
    public function createPluginResponse($data = '')
    {
        return new PluginResponse(
            $data, 200, [],
            $this->pageStack, $this->jarves, $this->stopwatch, $this->assetCompilerContainer, $this->eventDispatcher, $this->templating, $this->editMode
        );
    }
}
